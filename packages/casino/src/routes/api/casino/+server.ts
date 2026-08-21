import { json } from '@sveltejs/kit';
import { balanceOf, collector, ensureCasinoMint, ensureCollectorAta, HOUSE, DECIMALS } from '$lib/server/solana';

export async function GET({ url }) {
  const mint = ensureCasinoMint();
  await ensureCollectorAta(); // bets land here; make sure its token account exists
  const wallet = url.searchParams.get('wallet');
  const balance = wallet && wallet.length > 20 ? await balanceOf(wallet) : null;
  return json({ mint: mint.toBase58(), house: HOUSE.toBase58(), collector: collector().toBase58(), decimals: DECIMALS, balance });
}
