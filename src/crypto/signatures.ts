import crypto from 'crypto';
import { SignedGrantPayload } from '../types/domain';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]));
  }
  return value;
}
export function canonicalizePayload(payload: SignedGrantPayload): string { return JSON.stringify(stable(payload)); }
export function signPayloadWithPrivateKey(payload: SignedGrantPayload, privateKeyPem: string): string {
  const signer = crypto.createSign('RSA-SHA256'); signer.update(canonicalizePayload(payload)); signer.end(); return signer.sign(privateKeyPem, 'base64');
}
export function verifyMemberSignature(payload: SignedGrantPayload, signatureBase64: string, publicKeyPem: string): boolean {
  try { const verifier = crypto.createVerify('RSA-SHA256'); verifier.update(canonicalizePayload(payload)); verifier.end(); return verifier.verify(publicKeyPem, signatureBase64, 'base64'); } catch { return false; }
}
export function computeHmacSha256(rawBody: string, secret: string): string { return crypto.createHmac('sha256', secret).update(rawBody).digest('hex'); }
export function verifyHmacSha256(rawBody: string, signatureHex: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signatureHex)) return false;
  const expected = Buffer.from(computeHmacSha256(rawBody, secret), 'hex');
  const actual = Buffer.from(signatureHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
