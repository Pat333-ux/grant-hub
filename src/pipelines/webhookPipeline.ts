import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { GRANT_QUEUE_NAMES } from './queues';
import { ProviderWebhookEvent } from '../types/domain';
import { repository } from '../store/repository';
import { dispatchOutboundWebhook } from '../webhooks/outboundDispatcher';
export const grantWebhookWorker = new Worker<ProviderWebhookEvent>(GRANT_QUEUE_NAMES.WEBHOOKS, async (job: Job<ProviderWebhookEvent>) => {
  const event = job.data; const existing = repository.getApplication(event.applicationId);
  if (!existing || existing.providerId !== event.providerId) throw new Error(`Application not found for provider webhook: ${event.applicationId}`);
  const updated = repository.upsertApplication({ ...existing, status: event.status, externalRefId: event.externalRefId || existing.externalRefId, awardedAmount: event.awardedAmount ?? existing.awardedAmount, updatedAt: new Date().toISOString() });
  await dispatchOutboundWebhook('grant.provider_webhook_processed', { eventId: event.eventId, ...updated }); return updated;
}, { connection: redisConnection, concurrency: 5 });
