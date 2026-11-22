import crypto from 'crypto';
export interface KeyPairPem { publicKeyPem: string; privateKeyPem: string; }
export function generateMemberKeyPair(): KeyPairPem {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
}
