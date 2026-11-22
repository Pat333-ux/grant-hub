import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { SignedGrantPayload } from '../types/domain';
import { repository } from '../store/repository';
import { matchingEngine } from '../engine/matchingEngine';
import { verifyMemberSignature } from '../crypto/signatures';
import { grantApplicationQueue, grantMatchingQueue } from '../pipelines/queues';
import { handleProviderWebhook } from '../webhooks/webhookController';
const router = Router();
const applicantSchema = z.object({ applicantId: z.string().default(() => `app_${uuidv4().slice(0, 8)}`), fullName: z.string().min(2), email: z.string().email(), phone: z.string().min(10), streetAddress: z.string().min(3), city: z.string().min(2), state: z.string().min(2), postalCode: z.string().min(3), householdSize: z.number().int().positive(), annualHouseholdIncome: z.number().nonnegative(), isVeteran: z.boolean().default(false), isDisabilityBenefitRecipient: z.boolean().default(false), primaryGrantCategory: z.enum(['housing_stabilization', 'family_first', 'education_skills', 'emergency_assistance', 'small_business']).default('family_first') });
const signedSchema = z.object({ payload: z.object({ requestId: z.string().min(1), memberId: z.string().min(1), timestamp: z.number(), nonce: z.string().min(6), selectedGrantIds: z.array(z.string()).min(1), applicant: applicantSchema }), signature: z.string().min(10) });
router.post('/members/register', (req: Request, res: Response) => {
  const memberId = typeof req.body?.memberId === 'string' && req.body.memberId.trim() ? req.body.memberId.trim() : `member_${uuidv4().slice(0, 8)}`;
  const publicKeyPem = req.body?.publicKeyPem;
  if (typeof publicKeyPem !== 'string' || publicKeyPem.length > 10000) return res.status(400).json({ error: 'A client-generated publicKeyPem is required' });
  try { require('crypto').createPublicKey(publicKeyPem); } catch { return res.status(400).json({ error: 'Invalid public key' }); }
  repository.registerMember(memberId, publicKeyPem);
  return res.status(201).json({ memberId });
});
router.get('/grants/active', (_req: Request, res: Response) => { const grants = repository.listActiveGrants(); return res.json({ count: grants.length, grants }); });
router.post('/matching/evaluate', async (req: Request, res: Response) => {
  const parsed = applicantSchema.safeParse(req.body?.applicant); if (!parsed.success) return res.status(400).json({ error: 'Invalid applicant profile for matching', details: parsed.error.flatten() });
  const grants = repository.listActiveGrants(); const matches = matchingEngine.rankGrantMatches(parsed.data, grants);
  if (typeof req.body?.memberId === 'string') await grantMatchingQueue.add('evaluate_background_matching', { memberId: req.body.memberId, applicant: parsed.data });
  return res.json({ evaluatedCount: grants.length, eligibleCount: matches.filter((m) => m.eligible).length, matches });
});
router.post('/applications/submit-signed', async (req: Request, res: Response) => {
  const parsed = signedSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid signed application payload structure', details: parsed.error.flatten() });
  const { payload, signature } = parsed.data as { payload: SignedGrantPayload; signature: string };
  const member = repository.getMember(payload.memberId); if (!member) return res.status(404).json({ error: 'Member is not registered' });
  if (Math.abs(Date.now() - payload.timestamp) > 5 * 60 * 1000) return res.status(400).json({ error: 'Signed payload timestamp expired' });
  if (!verifyMemberSignature(payload, signature, member.publicKeyPem)) return res.status(401).json({ error: 'Cryptographic signature verification failed' });
  if (!payload.selectedGrantIds.every((id) => repository.getGrant(id)?.active)) return res.status(400).json({ error: 'One or more selected grants are unknown or inactive' });
  if (!repository.consumeNonce(payload.memberId, payload.nonce)) return res.status(409).json({ error: 'Replay attack detected: nonce already consumed' });
  const records = payload.selectedGrantIds.map((grantId) => { const grant = repository.getGrant(grantId)!; return repository.upsertApplication({ applicationId: `grant_app_${uuidv4()}`, requestId: payload.requestId, memberId: payload.memberId, grantId, providerId: grant.providerId, status: 'QUEUED', updatedAt: new Date().toISOString() }); });
  await Promise.all(records.map((r) => grantApplicationQueue.add(`submit_${r.providerId}`, { applicationId: r.applicationId, requestId: payload.requestId, memberId: payload.memberId, grantId: r.grantId, providerId: r.providerId, applicant: payload.applicant })));
  return res.status(202).json({ requestId: payload.requestId, memberId: payload.memberId, queuedCount: records.length, applications: records });
});
router.get('/members/:memberId/applications', (req: Request, res: Response) => {
  const apps = repository.listApplicationsByMember(req.params.memberId); const approved = apps.filter((a) => a.status === 'APPROVED');
  return res.json({ memberId: req.params.memberId, totalApplicationsSubmitted: apps.length, approvedGrantsCount: approved.length, totalFundingAwarded: approved.reduce((sum, a) => sum + (a.awardedAmount ?? 0), 0), applications: apps });
});
router.post('/webhooks/providers', handleProviderWebhook);
export default router;
