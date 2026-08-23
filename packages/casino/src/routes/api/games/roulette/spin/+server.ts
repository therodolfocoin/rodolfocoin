import { json } from '@sveltejs/kit';
import { roulette, isRoulettePick } from '$lib/server/games';
import { payOut } from '$lib/server/solana';
import { parseBet, requireConfirmedBet } from '$lib/server/validate';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { bet, player, betTx } = parseBet(body);
  if (!isRoulettePick(body.pick)) throw Object.assign(new Error('invalid pick'), { status: 400 });
  await requireConfirmedBet(betTx);
  const res = roulette(bet, body.pick);
  const payoutTx = res.win > 0 ? (await payOut(player, res.win)) || null : null;
  return json({ ...res, payoutTx });
}
