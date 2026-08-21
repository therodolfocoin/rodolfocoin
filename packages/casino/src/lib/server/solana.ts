import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';

// works under SvelteKit (Vite sets it) and unit tests (absent => false)
const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const DECIMALS = 6;

// canonical $K mint (fixed supply, no minting here); ROdolfoCoinMINT env overrides
export const DEFAULT_MINT = '2kEZzHWT8qAUfGEH3RQp6km5wuQTqBqXbs6HTYzS6RPx';

// same wallet convention as @rodolfocoins/coin-gen: .keys/devnet.json or RODOLFOCOIN_SECRET
export function loadHouseKeypair() {
  if (process.env.RODOLFOCOIN_SECRET) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.RODOLFOCOIN_SECRET)));
  }
  const file = join(process.cwd(), '../../.keys/devnet.json');
  if (existsSync(file)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, 'utf8'))));
  }
  const kp = Keypair.generate();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify([...kp.secretKey]));
  return kp;
}

export const conn = new Connection(DEVNET_RPC, 'confirmed');
export const house: Keypair = loadHouseKeypair();
export const HOUSE = house.publicKey;

const unit = 10 ** DECIMALS;
export const coins = (n: number) => BigInt(Math.round(n * unit));
export const asCoins = (u: bigint) => Number(u) / unit;

let cachedMint: PublicKey | null = null;
export function ensureCasinoMint(): PublicKey {
  if (cachedMint) return cachedMint;
  const env = process.env.RODOLFOCOIN_MINT;
  cachedMint = new PublicKey(env ?? DEFAULT_MINT);
  return cachedMint;
}

// the casino bankroll: a per-machine keypair persisted at .casino/collector.json (gitignored)
let cachedCollectorKp: Keypair | null = null;
function collectorFile() {
  return join(process.cwd(), '.casino/collector.json');
}
export function collectorKeypair(): Keypair {
  if (cachedCollectorKp) return cachedCollectorKp;
  const file = collectorFile();
  if (existsSync(file)) {
    cachedCollectorKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, 'utf8')).secret));
    return cachedCollectorKp;
  }
  const kp = Keypair.generate();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ collector: kp.publicKey.toBase58(), secret: [...kp.secretKey] }));
  cachedCollectorKp = kp;
  return kp;
}

// where lost bets collect: CASINO_COLLECTOR env wins, else the bankroll keypair itself
export function collector(): PublicKey {
  const env = process.env.CASINO_COLLECTOR;
  if (env) {
    try {
      return new PublicKey(env);
    } catch {
      // fall through to the persisted bankroll
    }
  }
  return collectorKeypair().publicKey;
}

export async function ensureAta(owner: PublicKey, mint: PublicKey) {
  const ata = await getOrCreateAssociatedTokenAccount(conn, house, mint, owner);
  return ata.address;
}

export async function balanceOf(owner: string): Promise<number> {
  const mint = ensureCasinoMint();
  try {
    const ata = await getAssociatedTokenAddress(mint, new PublicKey(owner), true);
    const acc = await getAccount(conn, ata).catch(() => null);
    return acc ? asCoins(acc.amount) : 0;
  } catch {
    return 0;
  }
}

export async function ensureFunded(pubkey: PublicKey) {
  for (let i = 0; i < 3; i++) {
    if ((await conn.getBalance(pubkey)) >= 0.02 * 1e9) return;
    try {
      await conn.requestAirdrop(pubkey, 1e9);
    } catch {
      // faucet dry; keep retrying
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  if ((await conn.getBalance(pubkey)) < 0.005 * 1e9) {
    throw new Error(`devnet faucet dry — cannot fund ${pubkey.toBase58()} with SOL to pay fees`);
  }
}

// make sure the collector's token account exists (house pays the rent) so player bets can land
let collectorAtaPromise: Promise<PublicKey> | null = null;
export function ensureCollectorAta(): Promise<PublicKey> {
  if (!collectorAtaPromise) {
    collectorAtaPromise = (async () => {
      await ensureFunded(HOUSE);
      return ensureAta(collector(), ensureCasinoMint());
    })();
  }
  return collectorAtaPromise;
}

// pay winnings out of the bankroll (the collector keypair holds the $K it raked
// and pays wins from that same balance — no minting)
export async function payOut(to: string, amount: number) {
  if (amount < 0.000001) return null;
  // ponytail: dev bypasses the settlement transfer (mirrors the bet-confirmation
  // bypass) so local play never depends on the devnet faucet/bankroll; production pays for real
  if (isDev) return null;
  const paymaster = collectorKeypair();
  await ensureFunded(paymaster.publicKey);
  const mint = ensureCasinoMint();
  const fromAta = await ensureAta(paymaster.publicKey, mint);
  const toAta = await ensureAta(new PublicKey(to), mint);
  const sig = await transfer(conn, paymaster, fromAta, toAta, paymaster.publicKey, coins(amount), []);
  await conn.confirmTransaction(sig, 'confirmed');
  return sig;
}

export function isValidSolanaAddress(v: string) {
  try {
    new PublicKey(v);
    return true;
  } catch {
    return false;
  }
}

// ponytail: trusts that a confirmed bet tx went to the collector; a real audit would parse the tx
export async function betIsConfirmed(sig: string): Promise<boolean> {
  try {
    const status = await conn.getSignatureStatus(sig);
    const s = status.value;
    return !!s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized');
  } catch {
    return false;
  }
}

export const rng = () => randomInt(1_000_000) / 1_000_000;
export const randomIntUpTo = (n: number) => randomInt(n);
