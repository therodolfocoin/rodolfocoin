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

const MINT = process.argv[2];
if (!MINT) {
  console.error('usage: bun src/burn-coin.ts <mint-address>');
  process.exit(1);
}

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync('../../.keys/devnet.json', 'utf8'))));
const mint = new PublicKey(MINT);

// detect which token program owns the mint
const programId = (await getMint(conn, mint, 'confirmed', TOKEN_PROGRAM_ID).catch(() => null))
  ? TOKEN_PROGRAM_ID
  : TOKEN_2022_PROGRAM_ID;

const ata = getAssociatedTokenAddressSync(mint, payer.publicKey, false, programId);
const account = await getAccount(conn, ata, 'confirmed', programId).catch(() => null);

if (!account || account.amount === 0n) {
  console.log(`${MINT}: no tokens to burn`);
} else {
  await burn(conn, payer, ata, mint, payer.publicKey, account.amount, [], 'confirmed', programId);
  console.log(`${MINT}: burned ${Number(account.amount) / 10 ** (await getMint(conn, mint, 'confirmed', programId)).decimals} tokens (supply now 0)`);
  await closeAccount(conn, payer, ata, payer.publicKey, payer.publicKey, [], 'confirmed', programId);
  console.log(`${MINT}: token account closed, rent reclaimed`);
}
