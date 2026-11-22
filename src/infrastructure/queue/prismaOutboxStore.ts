import { Prisma, PrismaClient } from '@prisma/client';
import { OutboxRecord, OutboxStore } from './outboxWorker';

interface OutboxRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payloadJson: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
}

/** PostgreSQL-backed lease store. Each claim runs in a single UPDATE statement, so
 * concurrent workers skip rows locked by another transaction and stale leases recover.
 */
export class PrismaOutboxStore implements OutboxStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly leaseDurationMs = 60_000,
  ) {
    if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 1) {
      throw new Error('leaseDurationMs must be a positive integer');
    }
  }

  async claimBatch(workerId: string, batchSize: number): Promise<OutboxRecord[]> {
    if (!workerId.trim()) throw new Error('workerId is required');
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
      throw new Error('batchSize must be an integer between 1 and 500');
    }

    const rows = await this.prisma.$queryRaw<OutboxRow[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE (
          ("status" = 'PENDING' AND "availableAt" <= NOW())
          OR (
            "status" = 'PROCESSING'
            AND ("lockedAt" IS NULL OR "lockedAt" <= NOW() - (${this.leaseDurationMs} * INTERVAL '1 millisecond'))
          )
        )
        AND "attempts" < "maxAttempts"
        ORDER BY "availableAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      UPDATE "OutboxEvent" AS event
      SET "status" = 'PROCESSING', "lockedAt" = NOW(), "lockedBy" = ${workerId}, "updatedAt" = NOW()
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id", event."aggregateType", event."aggregateId", event."eventType",
        event."payloadJson", event."attempts", event."maxAttempts"
    `);

    return rows.map((row) => ({
      ...row,
      payloadJson: row.payloadJson as Record<string, unknown>,
    }));
  }

  async markCompleted(id: string, workerId: string): Promise<void> {
    const updated = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "OutboxEvent"
      SET "status" = 'COMPLETED', "lockedAt" = NULL, "lockedBy" = NULL,
        "lastError" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "status" = 'PROCESSING' AND "lockedBy" = ${workerId}
    `);
    if (updated !== 1) throw new Error(`Outbox lease lost before completing event ${id}`);
  }

  async markRetryOrDeadLetter(
    id: string,
    workerId: string,
    attempts: number,
    maxAttempts: number,
    errorMessage: string,
    backoffMs: number,
  ): Promise<void> {
    const updated = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "OutboxEvent"
      SET "attempts" = ${attempts},
        "status" = CASE WHEN ${attempts} >= ${maxAttempts} THEN 'DEAD_LETTER'::"OutboxStatus" ELSE 'PENDING'::"OutboxStatus" END,
        "availableAt" = CASE WHEN ${attempts} >= ${maxAttempts} THEN "availableAt" ELSE NOW() + (${backoffMs} * INTERVAL '1 millisecond') END,
        "lockedAt" = NULL, "lockedBy" = NULL, "lastError" = ${errorMessage}, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "status" = 'PROCESSING' AND "lockedBy" = ${workerId}
    `);
    if (updated !== 1) throw new Error(`Outbox lease lost before retrying event ${id}`);
  }
}
