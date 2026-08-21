import { json } from '@sveltejs/kit';
import { balanceOf, collector, ensureCasinoMint, ensureCollectorAta, HOUSE, DECIMALS } from '$lib/server/solana';

export async function GET({ url }) {
  const mint = ensureCasinoMint();
  // bets land in the collector ATA; set it up in the background once —
  // don't put an RPC round-trip on this hot path (polled by every open tab)
  ensureCollectorAta().catch(() => {});
  const wallet = url.searchParams.get('wallet');
  const balance = wallet && wallet.length > 20 ? await balanceOf(wallet) : null;
  return json({ mint: mint.toBase58(), house: HOUSE.toBase58(), collector: collector().toBase58(), decimals: DECIMALS, balance });
}
