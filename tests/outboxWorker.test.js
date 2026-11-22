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
  payloadJson: { applicationId: `app-${id}` },
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
    async markRetryOrDeadLetter(...args) {
      this.retries.push(args);
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
});

test('schedules a retry for transient publisher failure', async () => {
  const store = fakeStore([event('retry', 0, 3)]);
  const result = await runOutboxBatch(store, async () => { throw new Error('temporary'); }, 'worker-b');
  assert.deepEqual(result, { processed: 1, succeeded: 0, failed: 1 });
  const [id, workerId, attempts, maxAttempts, message, backoffMs] = store.retries[0];
  assert.equal(id, 'retry');
  assert.equal(workerId, 'worker-b');
  assert.equal(attempts, 1);
  assert.equal(maxAttempts, 3);
  assert.equal(message, 'temporary');
  assert.ok(backoffMs >= 1000 && backoffMs < 1250);
});

test('passes the terminal attempt to the store for dead-letter transition', async () => {
  const store = fakeStore([event('dead', 2, 3)]);
  await runOutboxBatch(store, async () => { throw new Error('permanent'); }, 'worker-c');
  assert.equal(store.retries[0][2], 3);
  assert.equal(store.retries[0][3], 3);
  assert.equal(store.retries[0][4], 'permanent');
});
