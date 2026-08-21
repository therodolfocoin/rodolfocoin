import { json } from '@sveltejs/kit';
import { holdemAct, hview } from '$lib/server/games';
import { payOut } from '$lib/server/solana';
import { open, seal } from '$lib/server/session';
import { parseToken } from '$lib/server/validate';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const token = parseToken(body);
  const action = body?.action;
  if (action !== 'fold' && action !== 'check' && action !== 'call' && action !== 'raise')
    return json({ ok: false, error: 'invalid action' }, { status: 400 });
  const s = open<import('$lib/server/games').HoldemState>(token);
  const { state, yourTurn, payout } = holdemAct(s, action);
  const payoutTx = payout ? (await payOut(state.player, payout)) || null : null;
  return json({
    token: seal(state),
    view: hview(state, state.over),
    payout,
    payoutTx,
    yourTurn,
    over: state.over,
  });
}
