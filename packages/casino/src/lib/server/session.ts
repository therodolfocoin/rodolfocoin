import { sign, verify, hashes } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { house } from './solana';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';

hashes.sha512 = sha512;

const seed = () => house.secretKey.slice(0, 32);
const pub = () => house.publicKey.toBytes();

// House-signed session tokens: stateless server, no DB. Client can't forge payout state.
export function seal(payload: unknown): string {
  const raw = JSON.stringify(payload);
  const body = Buffer.from(raw).toString('base64url');
  const sig = sign(new Uint8Array(Buffer.from(raw)), seed());
  return body + '.' + Buffer.from(sig).toString('base64url');
}

export function open<T>(token: string): T {
  const [body, sig] = token.split('.');
  const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  const ok = verify(Buffer.from(sig, 'base64url'), new Uint8Array(Buffer.from(JSON.stringify(raw))), pub());
  if (!ok) throw error(400, 'session token was tampered with');
  return raw as T;
}

export const newId = () => randomUUID();
