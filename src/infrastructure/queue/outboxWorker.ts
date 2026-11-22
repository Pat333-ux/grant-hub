export interface OutboxRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payloadJson: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export interface OutboxStore {
  claimBatch(workerId: string, batchSize: number): Promise<OutboxRecord[]>;
  markCompleted(id: string, workerId: string): Promise<void>;
  markRetryOrDeadLetter(
    id: string,
    workerId: string,
    attempts: number,
    maxAttempts: number,
    errorMessage: string,
    backoffMs: number
  ): Promise<void>;
}

export type OutboxPublisher = (event: OutboxRecord) => Promise<void>;

export function computeExponentialBackoffMs(
  attemptNumber: number,
  baseMs = 1000,
  maxMs = 60000
): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attemptNumber - 1)));
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
}

export async function runOutboxBatch(
  store: OutboxStore,
  publisher: OutboxPublisher,
  workerId: string,
  batchSize = 25
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const batch = await store.claimBatch(workerId, batchSize);
  let succeeded = 0;
  let failed = 0;

  for (const event of batch) {
    try {
      await publisher(event);
      await store.markCompleted(event.id, workerId);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      const nextAttempts = event.attempts + 1;
      const message = err instanceof Error ? err.message : 'Unknown outbox dispatch error';
      const backoffMs = computeExponentialBackoffMs(nextAttempts);
      await store.markRetryOrDeadLetter(
        event.id,
        workerId,
        nextAttempts,
        event.maxAttempts,
        message,
        backoffMs
      );
    }
  }

  return { processed: batch.length, succeeded, failed };
}
