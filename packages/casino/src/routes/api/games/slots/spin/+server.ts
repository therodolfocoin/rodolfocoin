import { json } from '@sveltejs/kit';
import { spin } from '$lib/server/games';
import { payOut } from '$lib/server/solana';
import { parseBet, requireConfirmedBet } from '$lib/server/validate';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { bet, player, betTx } = parseBet(body);
  await requireConfirmedBet(betTx);
  const res = spin(bet);
  const payoutTx = res.win > 0 ? (await payOut(player, res.win)) || null : null;
  return json({ ...res, payoutTx });
}
