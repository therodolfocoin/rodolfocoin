import { json, error } from '@sveltejs/kit';
import { Chess } from 'chess.js';
import { pickAiMove, result } from '$lib/server/chess-ai';
import { payOut } from '$lib/server/solana';
import { open, seal } from '$lib/server/session';
import { parseToken } from '$lib/server/validate';
import type { ChessState } from '../start/+server';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const token = parseToken(body);
  const from = body?.from;
  const to = body?.to;
  if (typeof from !== 'string' || typeof to !== 'string')
    throw error(400, 'expected from/to squares');
  const s = open<ChessState>(token);
  if (s.over) throw error(400, 'game is over');
  const game = new Chess(s.fen);
  if (game.turn() !== s.color) throw error(400, 'not your turn');
  try {
    game.move({ from, to, promotion: 'q' });
  } catch {
    throw error(400, 'illegal move');
  }

  let over = false;
  let resultOut: ChessState['result'];
  let payout = 0;
  let payoutTx: string | null = null;
  let ai = null;
  const last = { from, to };

  if (game.isGameOver()) {
    const r = result(game, s.color);
    payout = r.out === 'win' ? s.bet * 2 : r.out === 'draw' ? s.bet : 0;
    payoutTx = payout > 0 ? (await payOut(s.player, payout)) || null : null;
    resultOut = { ...r, payout };
    over = true;
  } else {
    ai = pickAiMove(game, game.turn());
    if (ai) {
      game.move({ from: ai.from, to: ai.to, promotion: 'q' });
      if (game.isGameOver()) {
        const r = result(game, s.color);
        payout = r.out === 'win' ? s.bet * 2 : r.out === 'draw' ? s.bet : 0;
        payoutTx = payout > 0 ? (await payOut(s.player, payout)) || null : null;
        resultOut = { ...r, payout };
        over = true;
      }
    }
  }

  const next: ChessState = { ...s, fen: game.fen(), over, result: resultOut };
  return json({ token: seal(next), fen: game.fen(), turn: game.turn(), over, result: resultOut, payout, payoutTx, last, ai });
}
