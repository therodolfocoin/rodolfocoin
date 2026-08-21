import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

export const RPC = 'https://api.devnet.solana.com';
const conn = new Connection(RPC, 'confirmed');

// browser-safe spl-token helpers: @solana/spl-token has no browser bundle (pulls node buffer), so
// compute the ATA PDA and the transfer instruction from web3.js primitives only.
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export async function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

function transferInstructionData(amount: bigint): Uint8Array {
  // 1-byte discriminator (3 = Transfer) + u64 amount little-endian
  const data = new Uint8Array(9);
  data[0] = 3;
  for (let i = 0; i < 8; i++) {
    data[i + 1] = Number((amount >> BigInt(i * 8)) & 0xffn);
  }
  return data;
}

export function createTransferInstruction(source: PublicKey, destination: PublicKey, owner: PublicKey, amount: bigint) {
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    // web3's TS type wants Buffer; runtime accepts a Uint8Array (we avoid node's Buffer on the client)
    data: transferInstructionData(amount) as unknown as Buffer,
  });
}

export interface WalletLike {
  publicKey?: unknown;
  isPhantom?: boolean;
  connect(options?: unknown): Promise<{ publicKey: unknown }>;
  disconnect(): Promise<void>;
  signAndSendTransaction(tx: Transaction): Promise<string | { signature: string }>;
}

declare global {
  interface Window {
    solana?: WalletLike;
    phantom?: { solana?: WalletLike };
  }
}

export function detectWallet(): WalletLike | null {
  if (typeof window === 'undefined') return null;
  return window.phantom?.solana ?? window.solana ?? null;
}

export function pubkeyToAddress(pk: unknown): string {
  if (pk == null) return '';
  if (typeof pk === 'string') return pk;
  const p = pk as { toBase58?: () => unknown; toString?: () => string; toBytes?: () => Uint8Array };
  if (typeof p.toBase58 === 'function') return String(p.toBase58() ?? '');
  if (typeof p.toBytes === 'function') return new PublicKey(p.toBytes()).toBase58();
  return '';
}

export function isAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function walletConnect(): Promise<string> {
  const w = detectWallet();
  if (!w) throw new Error('No Solana wallet detected. Install Phantom (or any injected wallet) and reload.');
  const res = await w.connect();
  return pubkeyToAddress(res.publicKey ?? w.publicKey);
}

export async function walletDisconnect() {
  try {
    await detectWallet()?.disconnect();
  } catch {
    /* already gone */
  }
}

export async function casinoInfo(): Promise<{ mint: string; house: string; collector: string; decimals: number; balance: number | null }> {
  const res = await fetch('/api/casino');
  return (await res.json()) as never;
}

// build & (wallet-)sign a real bet transfer player ATA -> collector ATA, returning the tx signature
export async function betTx(mint: string, collector: string, from: string, bet: number, decimals = 6): Promise<string> {
  const w = detectWallet();
  if (!w) throw new Error('No wallet');
  const mintPub = new PublicKey(mint);
  const fromAta = await getAssociatedTokenAddress(mintPub, new PublicKey(from));
  const toAta = await getAssociatedTokenAddress(mintPub, new PublicKey(collector));
  const tx = new Transaction();
  tx.add(createTransferInstruction(fromAta, toAta, new PublicKey(from), BigInt(Math.round(bet * 10 ** decimals))));
  const block = await conn.getLatestBlockhash();
  tx.recentBlockhash = block.blockhash;
  tx.feePayer = new PublicKey(from);
  const sig = await w.signAndSendTransaction(tx);
  return typeof sig === 'string' ? sig : sig.signature;
}

export function addressShort(addr: string) {
  return addr.slice(0, 5) + '…' + addr.slice(-4);
}
