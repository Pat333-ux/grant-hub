import { OutboxStatus, PrismaClient } from "@prisma/client";
import type {
  OutboxRecord,
  OutboxStore,
} from "../queue/outboxWorker.js";

export interface PostgresOutboxStoreOptions {
  leaseTimeoutMs?: number;
}

type ClaimedOutboxRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payloadJson: unknown;
  attempts: number;
  maxAttempts: number;
};

export class PostgresOutboxStore implements OutboxStore {
  private readonly leaseTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    options: PostgresOutboxStoreOptions = {}
  ) {
    this.leaseTimeoutMs = Math.max(0, options.leaseTimeoutMs ?? 120_000);
  }

  async claimBatch(workerId: string, batchSize: number): Promise<OutboxRecord[]> {
    const safeBatchSize = Math.max(1, Math.min(250, Math.floor(batchSize) || 1));
    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - this.leaseTimeoutMs);

    return this.prisma.$transaction(async (tx) => {
      const claimedRows = await tx.$queryRaw<ClaimedOutboxRow[]>`
        WITH candidate_events AS (
          SELECT id
          FROM "OutboxEvent"
          WHERE
            (
              status = 'PENDING'
              AND "availableAt" <= ${now}
            )
            OR
            (
              status = 'PROCESSING'
              AND "lockedAt" IS NOT NULL
              AND "lockedAt" <= ${leaseCutoff}
            )
          ORDER BY "availableAt" ASC, "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${safeBatchSize}
        )
        UPDATE "OutboxEvent" AS oe
        SET
          status = 'PROCESSING',
          "lockedAt" = ${now},
          "lockedBy" = ${workerId},
          "updatedAt" = ${now}
        FROM candidate_events
        WHERE oe.id = candidate_events.id
        RETURNING
          oe.id,
          oe."aggregateType",
          oe."aggregateId",
          oe."eventType",
          oe."payloadJson",
          oe.attempts,
          oe."maxAttempts"
      `;

      return claimedRows.map((row) => ({
        id: row.id,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        payloadJson:
          row.payloadJson !== null &&
          typeof row.payloadJson === "object" &&
          !Array.isArray(row.payloadJson)
            ? (row.payloadJson as Record<string, unknown>)
            : {},
        attempts: row.attempts,
        maxAttempts: row.maxAttempts,
      }));
    });
  }

  async markCompleted(id: string, workerId: string): Promise<void> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: OutboxStatus.PROCESSING,
        lockedBy: workerId,
      },
      data: {
        status: OutboxStatus.COMPLETED,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });

    this.assertLeaseOwned(result.count, id, workerId);
  }

  async markRetryOrDeadLetter(
    id: string,
    workerId: string,
    attempts: number,
    maxAttempts: number,
    errorMessage: string,
    backoffMs: number
  ): Promise<void> {
    const isDeadLetter = attempts >= maxAttempts;
    const nextAvailableAt = new Date(Date.now() + Math.max(0, backoffMs));
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: OutboxStatus.PROCESSING,
        lockedBy: workerId,
      },
      data: {
        status: isDeadLetter ? OutboxStatus.DEAD_LETTER : OutboxStatus.PENDING,
        attempts,
        availableAt: isDeadLetter ? new Date() : nextAvailableAt,
        lockedAt: null,
        lockedBy: null,
        lastError: errorMessage.slice(0, 2000),
      },
    });

    this.assertLeaseOwned(result.count, id, workerId);
  }

  private assertLeaseOwned(updatedCount: number, id: string, workerId: string): void {
    if (updatedCount !== 1) {
      throw new Error(
        `Outbox event ${id} is no longer leased by worker ${workerId}`
      );
    }
  }
}
