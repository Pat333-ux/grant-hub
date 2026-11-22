import { Request, Response } from 'express';
import { z } from 'zod';
import { verifyHmacSha256 } from '../crypto/signatures';
import { env } from '../config/env';
import { grantWebhookQueue } from '../pipelines/queues';
const schema = z.object({ eventId: z.string().min(1), providerId: z.enum(['federal_grants', 'state_fssa', 'municipal_taskforce', 'emergency_relief', 'community_foundation']), applicationId: z.string().min(1), externalRefId: z.string().min(1), status: z.enum(['QUEUED', 'SUBMITTED', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'FAILED']), awardedAmount: z.number().positive().optional(), occurredAt: z.string().datetime() });
export async function handleProviderWebhook(req: Request, res: Response) {
  const signature = req.header('X-Grant-Provider-Signature') ?? '';
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? '';
  if (!verifyHmacSha256(rawBody, signature, env.GRANT_PROVIDER_WEBHOOK_SECRET)) return res.status(401).json({ error: 'Invalid provider webhook signature' });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Malformed provider webhook payload', details: parsed.error.flatten() });
  await grantWebhookQueue.add(`provider_webhook_${parsed.data.providerId}`, parsed.data, { jobId: parsed.data.eventId });
  return res.status(202).json({ accepted: true, eventId: parsed.data.eventId });
}
