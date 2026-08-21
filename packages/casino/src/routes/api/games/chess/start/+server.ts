import { json } from '@sveltejs/kit';
import { Chess } from 'chess.js';
import { pickAiMove } from '$lib/server/chess-ai';
import { payOut } from '$lib/server/solana';
import { seal } from '$lib/server/session';
import { parseBet, requireConfirmedBet } from '$lib/server/validate';

export interface ChessState {
  bet: number;
  player: string;
  color: 'w' | 'b';
  fen: string;
  over: boolean;
  result?: { out: 'win' | 'loss' | 'draw'; reason: string; payout: number };
}

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { bet, player, betTx } = parseBet(body);
  await requireConfirmedBet(betTx);
  const color = body?.color;
  if (color !== 'w' && color !== 'b') return json({ ok: false, error: 'pick a color' }, { status: 400 });
  let game = new Chess();
  let aiMove = null;
  if (color === 'b') {
    aiMove = pickAiMove(game, game.turn());
    if (aiMove) game.move({ from: aiMove.from, to: aiMove.to, promotion: 'q' });
  }
  const state: ChessState = { bet, player, color, fen: game.fen(), over: false };
  return json({
    token: seal(state),
    fen: game.fen(),
    color,
    turn: game.turn(),
    ai: aiMove,
    over: false,
  });
}
