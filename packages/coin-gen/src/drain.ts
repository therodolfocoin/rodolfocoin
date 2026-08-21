import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  burn,
  closeAccount,
  getAccount,
} from '@solana/spl-token';
import { Connection, Keypair } from '@solana/web3.js';
import { readFileSync } from 'node:fs';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed', {
  fetch: (url: URL, init?: RequestInit) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    return fetch(url, { ...init, signal: ac.signal }).finally(() => clearTimeout(t));
  },
});
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync('../../.keys/devnet.json', 'utf8'))));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 10) throw new Error('giving up after rate limits');
      console.log(`  (retry ${attempt + 1}: ${(e as Error).message})`);
      await sleep(1000 * (1 + attempt));
    }
  }
}

for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
  const { value } = await withRetry(() => conn.getTokenAccountsByOwner(payer.publicKey, { programId }));
  console.log(`program ${programId === TOKEN_PROGRAM_ID ? 'spl-token' : 'token-2022'}: ${value.length} account(s)`);
  for (const { pubkey, account } of value) {
    const parsed = await withRetry(() => getAccount(conn, pubkey, 'confirmed', programId));
    const { mint, amount } = parsed;
    if (amount > 0n) {
      await withRetry(() => burn(conn, payer, pubkey, mint, payer.publicKey, amount, [], 'confirmed', programId));
      console.log(`  burned ${amount} ${mint}`);
    }
    if (account.lamports > 0n) {
      await withRetry(() =>
        closeAccount(conn, payer, pubkey, payer.publicKey, payer.publicKey, [], 'confirmed', programId),
      );
      console.log(`  closed ${pubkey.toBase58()} (rent reclaimed)`);
    }
  }
}
console.log('done. wallet holds 0 tokens; SOL untouched.');
