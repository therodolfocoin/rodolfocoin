import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  burn,
  closeAccount,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
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
      if (attempt >= 10) throw e;
      console.log(`  (rate limited, retrying in ${1 + attempt}s...)`);
      await sleep(1000 * (1 + attempt));
    }
  }
}

async function mintsMintedByPayer(): Promise<string[]> {
  const mints = new Set<string>();
  let sigs = await withRetry(() => conn.getSignaturesForAddress(payer.publicKey, { limit: 1000 }));
  while (sigs.length) {
    console.log(`scanning ${sigs.length} txs...`);
    for (let i = 0; i < sigs.length; i += 5) {
      const chunk = sigs.slice(i, i + 5);
      const txs = await withRetry(() =>
        conn.getParsedTransactions(chunk.map((s) => s.signature), {
          maxSupportedTransactionVersion: 0,
        }),
      );
      for (const tx of txs) {
        if (!tx) continue;
        const insts = [
          ...tx.transaction.message.instructions,
          ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions),
        ];
        for (const i of insts) {
          if (i.program === 'spl-token' && (i as { parsed?: { type?: string } }).parsed?.type === 'mintTo') {
            const info = (i as { parsed: { info: { mint: string; authority: string } } }).parsed.info;
            if (info.authority === payer.publicKey.toBase58()) mints.add(info.mint);
          }
        }
      }
      await sleep(700);
    }
    if (sigs.length < 1000) break;
    sigs = await withRetry(() =>
      conn.getSignaturesForAddress(payer.publicKey, {
        limit: 1000,
        before: sigs[sigs.length - 1].signature,
      }),
    );
  }
  return [...mints];
}

async function burnForMint(mintAddr: string) {
  const mint = new PublicKey(mintAddr);
  const programId = (await getMint(conn, mint, 'confirmed', TOKEN_PROGRAM_ID).catch(() => null))
    ? TOKEN_PROGRAM_ID
    : TOKEN_2022_PROGRAM_ID;
  const ata = getAssociatedTokenAddressSync(mint, payer.publicKey, false, programId);
  const account = await getAccount(conn, ata, 'confirmed', programId).catch(() => null);
  const supply = (await withRetry(() => getMint(conn, mint, 'confirmed', programId))).supply;
  if (!account || account.amount === 0n) {
    console.log(`  ${mintAddr}: server holds 0 | supply=${supply}`);
    return;
  }
  if (supply > 0n) {
    await withRetry(() => burn(conn, payer, ata, mint, payer.publicKey, account.amount, [], 'confirmed', programId));
    if (account.amount === supply) {
      await withRetry(() => closeAccount(conn, payer, ata, payer.publicKey, payer.publicKey, [], 'confirmed', programId));
      console.log(`  ${mintAddr}: BURNED all supply (${supply}), account closed`);
      return;
    }
  }
  console.log(`  ${mintAddr}: burned ${account.amount} / supply ${supply} (visitor-held remainder stays)`);
}

const mints = await mintsMintedByPayer();
console.log(`found ${mints.length} mint(s) created by this wallet`);
for (const m of mints) await burnForMint(m);
console.log('done. coins in visitor wallets cannot be burned without their keys.');
