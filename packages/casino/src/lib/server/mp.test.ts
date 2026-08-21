import { describe, expect, test } from 'bun:test';
import { Chess } from 'chess.js';
import { chessMove, createChess, createHoldem, holdemAct, joinChess, joinHoldem } from './mp';

describe('mp chess', () => {
	test('full flow: create, join, trade moves', () => {
		const r = createChess('alice', 10);
		expect(r.black).toBeNull();
		expect(() => chessMove(r.id, 'alice', 'e2', 'e4')).toThrow('waiting for an opponent');
		expect(() => joinChess(r.id, 'alice', 10)).toThrow('someone else');
		joinChess(r.id, 'bob', 10);
		expect(() => chessMove(r.id, 'bob', 'e7', 'e5')).toThrow('not your turn'); // bob is black
		chessMove(r.id, 'alice', 'e2', 'e4');
		const r2 = chessMove(r.id, 'bob', 'e7', 'e5');
		expect(r2.over).toBe(false);
		expect(new Chess(r2.fen).moves()).toContain('Nf3');
	});
});

describe('mp holdem', () => {
	test('fold-out hand: last player takes the whole pot', () => {
		const r = createHoldem('a', 1000);
		joinHoldem(r.id, 'b', 1000); // two players => hand starts
		expect(r.deck.length).toBe(48);
		let guard = 0;
		while (!r.over && guard++ < 50) holdemAct(r.id, r.players[r.current], 'fold');
		expect(r.over).toBe(true);
		expect(r.payouts!.reduce((a, b) => a + b, 0)).toBe(2000); // no money created or lost
		expect(Math.max(...r.payouts!)).toBeGreaterThan(1000); // someone profited
	});

	test('call-it-down hand reaches showdown with correct payouts', () => {
		const r = createHoldem('a', 5000);
		joinHoldem(r.id, 'b', 5000);
		let guard = 0;
		while (!r.over && guard++ < 100) holdemAct(r.id, r.players[r.current], 'call');
		expect(r.over).toBe(true);
		expect(r.board.length).toBe(5);
		expect(r.payouts!.reduce((a, b) => a + b, 0)).toBe(10000);
	});

	test('turn enforcement', () => {
		const r = createHoldem('a', 1000);
		joinHoldem(r.id, 'b', 1000);
		holdemAct(r.id, 'a', 'call'); // heads-up SB acts first preflop
		expect(() => holdemAct(r.id, 'a', 'call')).toThrow('not your turn');
	});
});
