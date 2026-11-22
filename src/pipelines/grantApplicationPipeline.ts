import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { GRANT_QUEUE_NAMES } from './queues';
import { ApplicantProfile, GrantProviderId } from '../types/domain';
import { repository } from '../store/repository';
import { IGrantProviderAdapter } from '../adapters/baseGrantAdapter';
import { FederalGrantAdapter } from '../adapters/providers/federalGrantAdapter';
import { StateFssaAdapter } from '../adapters/providers/stateFssaAdapter';
import { MunicipalTaskForceAdapter } from '../adapters/providers/municipalTaskForceAdapter';
import { EmergencyReliefAdapter } from '../adapters/providers/emergencyReliefAdapter';
import { CommunityFoundationAdapter } from '../adapters/providers/communityFoundationAdapter';
import { dispatchOutboundWebhook } from '../webhooks/outboundDispatcher';
const adapters: Record<GrantProviderId, IGrantProviderAdapter> = { federal_grants: new FederalGrantAdapter(), state_fssa: new StateFssaAdapter(), municipal_taskforce: new MunicipalTaskForceAdapter(), emergency_relief: new EmergencyReliefAdapter(), community_foundation: new CommunityFoundationAdapter() };
export interface GrantApplicationJobData { applicationId: string; requestId: string; memberId: string; grantId: string; providerId: GrantProviderId; applicant: ApplicantProfile; }
export const grantApplicationWorker = new Worker<GrantApplicationJobData>(GRANT_QUEUE_NAMES.APPLICATIONS, async (job: Job<GrantApplicationJobData>) => {
  const d = job.data; const adapter = adapters[d.providerId]; if (!adapter) throw new Error(`No adapter configured for provider: ${d.providerId}`);
  const response = await adapter.submitPrefilledGrantApplication(d.applicationId, d.grantId, d.applicant);
  const updated = repository.upsertApplication({ applicationId: d.applicationId, requestId: d.requestId, memberId: d.memberId, grantId: d.grantId, providerId: d.providerId, status: response.status, externalRefId: response.externalRefId, awardedAmount: response.awardedAmount, updatedAt: new Date().toISOString() });
  await dispatchOutboundWebhook('grant.application_submitted', { ...updated }); return updated;
}, { connection: redisConnection, concurrency: 5 });
