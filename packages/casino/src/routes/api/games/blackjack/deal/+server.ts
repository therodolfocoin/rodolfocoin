import { json } from '@sveltejs/kit';
import { bjDeal, bjView } from '$lib/server/games';
import { payOut } from '$lib/server/solana';
import { seal } from '$lib/server/session';
import { parseBet, requireConfirmedBet } from '$lib/server/validate';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { bet, player, betTx } = parseBet(body);
  await requireConfirmedBet(betTx);
  const { state, win } = bjDeal(bet, player, crypto.randomUUID());
  const payoutTx = win !== null && win > 0 ? (await payOut(player, win)) || null : null;
  return json({ token: seal(state), view: { ...bjView(state, win !== null), bet }, payoutTx, win });
}
