import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
export const GRANT_QUEUE_NAMES = { MATCHING: 'grant-pipeline:matching', APPLICATIONS: 'grant-pipeline:applications', WEBHOOKS: 'grant-pipeline:provider-webhooks' } as const;
const defaults = { attempts: 3, backoff: { type: 'exponential' as const, delay: 1000 }, removeOnComplete: 200, removeOnFail: 500 };
export const grantMatchingQueue = new Queue(GRANT_QUEUE_NAMES.MATCHING, { connection: redisConnection, defaultJobOptions: defaults });
export const grantApplicationQueue = new Queue(GRANT_QUEUE_NAMES.APPLICATIONS, { connection: redisConnection, defaultJobOptions: defaults });
export const grantWebhookQueue = new Queue(GRANT_QUEUE_NAMES.WEBHOOKS, { connection: redisConnection, defaultJobOptions: { ...defaults, attempts: 5, backoff: { type: 'exponential' as const, delay: 500 } } });
