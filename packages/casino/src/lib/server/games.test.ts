import { describe, test, expect } from 'bun:test';
import { bestOf5, hvalue, bjStand, bjDeal, holdemDeal, holdemAct } from './games';

// n = suit*13 + rank; rank 0=A..12=K, suit 0=♠ 1=♥ 2=♦ 3=♣
const c = (face: string, suit = 0) => {
  const F: Record<string, number> = { A: 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, T: 9, J: 10, Q: 11, K: 12 };
  return suit * 13 + F[face];
};

describe('poker hand evaluator', () => {
  test('royal flush > four aces > full house > flush > trips', () => {
    const royal = bestOf5([c('A', 0), c('K', 0), c('Q', 0), c('J', 0), c('T', 0)]);
    const quads = bestOf5([c('A', 0), c('A', 1), c('A', 2), c('A', 3), c('2', 0)]);
    const full = bestOf5([c('K', 0), c('K', 1), c('K', 2), c('Q', 0), c('Q', 1)]);
    const flush = bestOf5([c('A', 0), c('J', 0), c('9', 0), c('6', 0), c('3', 0)]);
    const trips = bestOf5([c('9', 0), c('9', 1), c('9', 2), c('K', 0), c('Q', 1)]);
    expect(royal).toBeGreaterThan(quads);
    expect(quads).toBeGreaterThan(full);
    expect(full).toBeGreaterThan(flush);
    expect(flush).toBeGreaterThan(trips);
  });

  test('wheel straight (A2345) loses to 6-high straight but beats a pair', () => {
    const wheel = bestOf5([c('A', 0), c('2', 1), c('3', 2), c('4', 3), c('5', 0)]);
    const sixHigh = bestOf5([c('2', 0), c('3', 1), c('4', 2), c('5', 3), c('6', 0)]);
    const pair = bestOf5([c('A', 0), c('A', 1), c('K', 0), c('Q', 0), c('J', 0)]);
    expect(sixHigh).toBeGreaterThan(wheel);
    expect(wheel).toBeGreaterThan(pair);
  });

  test('best 5 of 7 picks the best five cards', () => {
    const seven = [c('9', 0), c('8', 1), c('A', 2), c('K', 3), c('7', 0), c('2', 1), c('3', 2)];
    // best: keep A K 9 8 7 (ace-high, no pair/flush/straight)
    expect(bestOf5([c('A', 2), c('K', 3), c('9', 0), c('8', 1), c('7', 0)])).toBe(bestOf5(seven));
  });
});

describe('blackjack', () => {
  test('ace scoring: A+K=21, A+A=12', () => {
    expect(hvalue([c('A'), c('K')])).toBe(21);
    expect(hvalue([c('A'), c('A')])).toBe(12);
  });

  test('stand vs dealer bust pays 2x', () => {
    const s = bjDeal(10, 'y', 'id');
    expect(s.win).toBeNull();
    const { state, win } = bjStand({
      ...s.state,
      playerCards: [c('K', 0), c('8', 1)],
      dealer: [c('6', 0), c('6', 1)],
      deck: [c('9', 3), c('T', 3)],
    });
    expect(state.phase).toBe('done');
    expect(hvalue(state.dealer)).toBeGreaterThan(21);
    expect(win).toBe(20);
  });
});

describe('holdem machine', () => {
  test('a hand of pure folds resolves to an over state', () => {
    const st = holdemDeal(100, 'y', 'id');
    // pre-flop the machine already ran bots up to the player's decision
    expect(st.over).toBe(false);
    const result = holdemAct(st, 'fold');
    expect(result.state.over).toBe(true);
    expect(result.payout).toBeTypeOf('number');
    expect(result.payout).toBe(0);
  });
});
