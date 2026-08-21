import { json, error } from '@sveltejs/kit';
import { Chess } from 'chess.js';
import { legalTargets } from '$lib/server/chess-ai';
import { open } from '$lib/server/session';
import { parseToken } from '$lib/server/validate';
import type { ChessState } from '../start/+server';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const token = parseToken(body);
  const from = body?.from;
  if (typeof from !== 'string') throw error(400, 'expected a from square');
  const s = open<ChessState>(token);
  const game = new Chess(s.fen);
  if (game.turn() !== s.color) return json({ targets: [] });
  return json({ targets: legalTargets(game, from) });
}
