import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { GRANT_QUEUE_NAMES } from './queues';
import { ApplicantProfile } from '../types/domain';
import { repository } from '../store/repository';
import { matchingEngine } from '../engine/matchingEngine';
import { dispatchOutboundWebhook } from '../webhooks/outboundDispatcher';
export interface MatchingJobData { memberId: string; applicant: ApplicantProfile; }
export const matchingWorker = new Worker<MatchingJobData>(GRANT_QUEUE_NAMES.MATCHING, async (job: Job<MatchingJobData>) => {
  const { memberId, applicant } = job.data; const grants = repository.listActiveGrants(); const matches = matchingEngine.rankGrantMatches(applicant, grants);
  await dispatchOutboundWebhook('grant.matching_completed', { memberId, applicantId: applicant.applicantId, totalGrantsEvaluated: grants.length, eligibleMatchesCount: matches.filter((m) => m.eligible).length, topMatches: matches.slice(0, 3) });
  return { memberId, evaluatedCount: grants.length, matches };
}, { connection: redisConnection, concurrency: 5 });
