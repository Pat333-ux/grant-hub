import { env } from '../config/env';
import { computeHmacSha256 } from '../crypto/signatures';
export async function dispatchOutboundWebhook(eventName: string, data: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify({ event: eventName, timestamp: new Date().toISOString(), data });
  const signature = computeHmacSha256(body, env.OUTBOUND_WEBHOOK_SECRET);
  const response = await fetch(env.OUTBOUND_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Grant-Hub-Signature': signature }, body, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Outbound webhook returned HTTP ${response.status}`);
}
