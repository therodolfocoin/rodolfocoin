import { json } from '@sveltejs/kit';
import { bjStand, bjView, type BJState } from '$lib/server/games';
import { payOut } from '$lib/server/solana';
import { seal } from '$lib/server/session';
import { parseToken } from '$lib/server/validate';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const token = parseToken(body);
  const { open } = await import('$lib/server/session');
  const s = open<BJState>(token);
  const { state, win } = bjStand(s);
  const payoutTx = win > 0 ? (await payOut(state.player, win)) || null : null;
  return json({ token: seal(state), view: bjView(state, true), payoutTx, win });
}
