import { json } from '@sveltejs/kit';
import { holdemDeal, holdemRunToPlayer, hview } from '$lib/server/games';
import { payOut } from '$lib/server/solana';
import { seal } from '$lib/server/session';
import { parseBet, requireConfirmedBet } from '$lib/server/validate';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { bet, player, betTx } = parseBet(body);
  await requireConfirmedBet(betTx);
  const { state, over, payout } = holdemRunToPlayer(holdemDeal(bet, player, crypto.randomUUID()));
  const payoutTx = over && payout ? (await payOut(player, payout)) || null : null;
  return json({
    token: seal(state),
    view: hview(state, over),
    payout,
    payoutTx,
    over,
  });
}
