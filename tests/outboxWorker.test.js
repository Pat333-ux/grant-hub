import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeExponentialBackoffMs,
  runOutboxBatch,
} from '../dist/infrastructure/queue/outboxWorker.js';

const event = (id, attempts = 0, maxAttempts = 3) => ({
  id,
  aggregateType: 'Application',
  aggregateId: `app-${id}`,
  eventType: 'application.submitted',
  payloadJson: { requestId: `req-${id}` },
  attempts,
  maxAttempts,
});

function fakeStore(batch) {
  return {
    completed: [],
    retries: [],
    async claimBatch(workerId, batchSize) {
      this.claim = { workerId, batchSize };
      return batch;
    },
    async markCompleted(id, workerId) {
      this.completed.push({ id, workerId });
    },
    async markRetryOrDeadLetter(id, workerId, attempts, maxAttempts, errorMessage, backoffMs) {
      this.retries.push({ id, workerId, attempts, maxAttempts, errorMessage, backoffMs });
    },
  };
}

test('computes capped exponential delay with bounded jitter', () => {
  const delay = computeExponentialBackoffMs(4, 1000, 5000);
  assert.ok(delay >= 5000 && delay < 5250);
});

test('dispatches and marks successful events complete', async () => {
  const store = fakeStore([event('success')]);
  const result = await runOutboxBatch(store, async () => {}, 'worker-a', 10);

  assert.deepEqual(result, { processed: 1, succeeded: 1, failed: 0 });
  assert.deepEqual(store.completed, [{ id: 'success', workerId: 'worker-a' }]);
  assert.deepEqual(store.claim, { workerId: 'worker-a', batchSize: 10 });
  assert.deepEqual(store.retries, []);
});

test('schedules a retry with exponential backoff for transient publisher failure', async () => {
  const store = fakeStore([event('retry', 0, 3)]);
  const result = await runOutboxBatch(store, async () => { throw new Error('temporary'); }, 'worker-b');

  assert.deepEqual(result, { processed: 1, succeeded: 0, failed: 1 });
  assert.deepEqual(store.retries[0], {
    id: 'retry',
    workerId: 'worker-b',
    attempts: 1,
    maxAttempts: 3,
    errorMessage: 'temporary',
    backoffMs: store.retries[0].backoffMs,
  });
  assert.ok(store.retries[0].backoffMs >= 1000 && store.retries[0].backoffMs < 1250);
});

test('passes the terminal attempt to the store for dead-letter transition', async () => {
  const store = fakeStore([event('dead', 2, 3)]);
  const result = await runOutboxBatch(store, async () => { throw new Error('permanent'); }, 'worker-c');

  assert.deepEqual(result, { processed: 1, succeeded: 0, failed: 1 });
  assert.equal(store.retries[0].id, 'dead');
  assert.equal(store.retries[0].attempts, 3);
  assert.equal(store.retries[0].maxAttempts, 3);
  assert.equal(store.retries[0].errorMessage, 'permanent');
});

test('recovers an event supplied by the store after a prior worker lease expires', async () => {
  // Lease expiry and reclaim are implemented by the persistent store; the worker
  // must be able to dispatch the reclaimed event and complete it under its new worker ID.
  const store = fakeStore([event('reclaimed', 1, 3)]);
  const result = await runOutboxBatch(store, async () => {}, 'worker-after-crash');

  assert.deepEqual(result, { processed: 1, succeeded: 1, failed: 0 });
  assert.deepEqual(store.completed, [{ id: 'reclaimed', workerId: 'worker-after-crash' }]);
});
