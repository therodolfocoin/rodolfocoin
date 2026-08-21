import { Chess, type Move } from 'chess.js';
import { rng, randomIntUpTo } from './solana';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function material(g: Chess, color: 'w' | 'b') {
  let s = 0;
  for (const row of g.board())
    for (const sq of row) {
      if (!sq) continue;
      s += sq.color === 'w' ? VALUE[sq.type] : -VALUE[sq.type];
    }
  return color === 'w' ? s : -s;
}

// depth-1 with jitter: strong enough to beat a casual player, dumb enough to lose
export function pickAiMove(game: Chess, color: 'w' | 'b'): { from: string; to: string; san: string } | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const m of moves) {
    const clone = new Chess(game.fen());
    clone.move({ from: m.from, to: m.to, promotion: 'q' });
    const score = clone.isCheckmate() ? 1000 : clone.isGameOver() ? 0 : material(clone, color) + rng() * 0.8;
    if (score > bestScore) { bestScore = score; best = [m]; }
    else if (score === bestScore) best.push(m);
  }
  const pick = best[randomIntUpTo(best.length)];
  return { from: pick.from, to: pick.to, san: pick.san };
}

export function legalTargets(game: Chess, from: string): string[] {
  return game.moves({ verbose: true }).filter((m) => m.from === from).map((m) => m.to);
}

export function result(g: Chess, playerColor: 'w' | 'b'): { out: 'win' | 'loss' | 'draw'; reason: string } {
  if (g.isCheckmate()) return g.turn() === playerColor ? { out: 'loss', reason: 'checkmate' } : { out: 'win', reason: 'checkmate' };
  if (g.isStalemate()) return { out: 'draw', reason: 'stalemate' };
  if (g.isInsufficientMaterial()) return { out: 'draw', reason: 'insufficient material' };
  if (g.isThreefoldRepetition()) return { out: 'draw', reason: 'threefold repetition' };
  if (g.isDraw()) return { out: 'draw', reason: 'draw' };
  throw Object.assign(new Error('game not over'), { status: 400 });
}
