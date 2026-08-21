import { Chess } from 'chess.js';
import { bestOf5, bigBlind, cardName, newDeck, STREET_LABEL } from './games';

// ponytail: rooms live in process memory — works for a single dev server;
// swap this Map for redis/durable objects when the casino runs multi-instance
const rooms = new Map<string, Room>();

const ROOM_TTL = 6 * 60 * 60 * 1000;
const MAX_BETS = 4;

const err = (m: string) => Object.assign(new Error(m), { status: 400 });

interface Base {
	id: string;
	game: 'chess' | 'holdem';
	bet: number; // ante / buy-in per player
	created: number;
}

export interface ChessRoom extends Base {
	game: 'chess';
	white: string;
	black: string | null;
	fen: string;
	over: boolean;
	outcome?: { winner: 'w' | 'b' | null; reason: string; payouts: { w: number; b: number } };
	paid?: boolean;
}

export interface HoldemRoom extends Base {
	game: 'holdem';
	players: string[];
	deck: number[];
	board: number[];
	hole: number[][];
	stacks: number[];
	invested: number[];
	folded: boolean[];
	street: 0 | 1 | 2 | 3 | 4;
	current: number;
	toCall: number;
	betCount: number;
	freeActed: boolean[];
	over: boolean;
	winners?: number[];
	payouts?: number[]; // final stack per seat, paid once the hand is over
	paidAll?: boolean;
}

type Room = ChessRoom | HoldemRoom;

function getRoom<T extends Room>(id: string, game: T['game']): T {
	const r = rooms.get(id);
	if (!r || r.game !== game) throw err('table not found');
	return r as T;
}

function prune() {
	const now = Date.now();
	for (const [id, r] of rooms) if (now - r.created > ROOM_TTL) rooms.delete(id);
}

export function openRooms(game: 'chess' | 'holdem') {
	prune();
	return [...rooms.values()]
		.filter((r) => {
			if (r.game !== game) return false;
			if (game === 'chess') return !(r as ChessRoom).black;
			const h = r as HoldemRoom;
			return h.players.length < 4 && !h.deck.length;
		})
		.sort((a, b) => b.created - a.created)
		.map((r) => ({
			roomId: r.id,
			bet: r.bet,
			host: r.game === 'chess' ? (r as ChessRoom).white : (r as HoldemRoom).players[0],
			seats: r.game === 'chess' ? ((r as ChessRoom).black ? 2 : 1) : (r as HoldemRoom).players.length,
		}));
}

// ---------------------------------------------------------------- chess

export function createChess(player: string, bet: number): ChessRoom {
	prune();
	const room: ChessRoom = {
		id: crypto.randomUUID(),
		game: 'chess',
		bet,
		created: Date.now(),
		white: player,
		black: null,
		fen: new Chess().fen(),
		over: false,
	};
	rooms.set(room.id, room);
	return room;
}

export function joinChess(id: string, player: string, bet: number): ChessRoom {
	const r = getRoom<ChessRoom>(id, 'chess');
	if (r.black) throw err('table already full');
	if (r.white === player) throw err('waiting for someone else to join');
	if (bet !== r.bet) throw err(`this table plays for ${r.bet} $K`);
	r.black = player;
	return r;
}

export function chessMove(id: string, player: string, from: string, to: string): ChessRoom {
	const r = getRoom<ChessRoom>(id, 'chess');
	if (!r.black) throw err('waiting for an opponent');
	if (r.over) throw err('game is over');
	const color = player === r.white ? 'w' : player === r.black ? 'b' : null;
	if (!color) throw err('you are not playing at this table');
	const g = new Chess(r.fen);
	if (g.turn() !== color) throw err('not your turn');
	try {
		g.move({ from, to, promotion: 'q' });
	} catch {
		throw err('illegal move');
	}
	r.fen = g.fen();
	if (g.isGameOver()) {
		r.over = true;
		let winner: 'w' | 'b' | null = color;
		let reason = 'checkmate';
		if (!g.isCheckmate()) {
			winner = null;
			reason = g.isStalemate()
				? 'stalemate'
				: g.isInsufficientMaterial()
					? 'insufficient material'
					: g.isThreefoldRepetition()
						? 'threefold repetition'
						: 'draw';
		}
		r.outcome = {
			winner,
			reason,
			payouts: winner === null ? { w: r.bet, b: r.bet } : winner === 'w' ? { w: r.bet * 2, b: 0 } : { w: 0, b: r.bet * 2 },
		};
	}
	return r;
}

function chessView(r: ChessRoom, player: string) {
	return {
		game: 'chess' as const,
		roomId: r.id,
		bet: r.bet,
		white: r.white,
		black: r.black,
		fen: r.fen,
		turn: new Chess(r.fen).turn(),
		joined: !!r.black,
		over: r.over,
		outcome: r.outcome ?? null,
		yourColor: player === r.white ? ('w' as const) : player === r.black ? ('b' as const) : null,
	};
}

// ---------------------------------------------------------------- hold'em (2-4 humans, one hand per table)

export function createHoldem(player: string, buyIn: number): HoldemRoom {
	prune();
	const room: HoldemRoom = {
		id: crypto.randomUUID(),
		game: 'holdem',
		bet: buyIn,
		created: Date.now(),
		players: [player],
		deck: [],
		board: [],
		hole: [],
		stacks: [],
		invested: [],
		folded: [],
		street: 0,
		current: -1,
		toCall: 0,
		betCount: 0,
		freeActed: [],
		over: false,
	};
	rooms.set(room.id, room);
	return room;
}

export function joinHoldem(id: string, player: string, buyIn: number): HoldemRoom {
	const r = getRoom<HoldemRoom>(id, 'holdem');
	if (r.deck.length) throw err('hand already started');
	if (r.players.includes(player)) throw err('already seated');
	if (r.players.length >= 4) throw err('table full');
	if (buyIn !== r.bet) throw err(`this table plays for ${r.bet} $K`);
	r.players.push(player);
	maybeStart(r);
	return r;
}

// starts the single hand as soon as a second player is seated
export function maybeStart(r: HoldemRoom) {
	if (r.players.length < 2 || r.deck.length) return false;
	r.deck = newDeck();
	r.hole = r.players.map(() => [r.deck.pop()!, r.deck.pop()!]);
	const bb = bigBlind(r.bet);
	const sb = Math.max(1, Math.floor(bb / 2));
	r.invested = r.players.map((_, i) => (i === 0 ? sb : i === 1 ? bb : 0));
	r.stacks = r.players.map((_, i) => r.bet - r.invested[i]);
	r.folded = r.players.map(() => false);
	r.freeActed = r.players.map(() => false);
	r.street = 0;
	r.toCall = bb;
	r.betCount = 1;
	// heads-up: button/small blind acts first preflop; otherwise UTG after the blinds
	r.current = r.players.length === 2 ? 0 : 2;
	return true;
}

const remaining = (r: HoldemRoom) => r.players.map((_, i) => i).filter((i) => !r.folded[i]);

function owes(r: HoldemRoom, i: number) {
	if (r.folded[i]) return false;
	if (r.toCall > 0) return r.invested[i] < r.toCall;
	return !r.freeActed[i];
}

function nextStreet(r: HoldemRoom) {
	if (r.street === 3) {
		r.street = 4;
		r.over = true;
		return;
	}
	r.street = (r.street + 1) as HoldemRoom['street'];
	if (r.street === 1) r.board.push(r.deck.pop()!, r.deck.pop()!, r.deck.pop()!);
	else r.board.push(r.deck.pop()!);
	r.toCall = 0;
	r.betCount = 0;
	r.freeActed = r.players.map(() => false);
	r.current = 0;
}

// advance until some human owes an action (and stop there) or the hand ends
function advance(r: HoldemRoom) {
	let guard = 0;
	while (!r.over && guard++ < 100) {
		const rem = remaining(r);
		if (rem.length <= 1) {
			r.over = true;
			return;
		}
		if (
			(r.toCall > 0 && rem.every((i) => r.invested[i] >= r.toCall)) ||
			(r.toCall === 0 && rem.every((i) => r.freeActed[i]))
		) {
			nextStreet(r);
			continue;
		}
		let next = -1;
		for (let k = 1; k <= r.players.length && next < 0; k++) {
			const i = (r.current + k) % r.players.length;
			if (owes(r, i)) next = i;
		}
		if (next < 0) {
			nextStreet(r);
			continue;
		}
		r.current = next;
		return;
	}
}

function doAction(r: HoldemRoom, i: number, action: 'fold' | 'check' | 'call' | 'raise') {
	if (action === 'fold') {
		r.folded[i] = true;
		return;
	}
	const bb = bigBlind(r.bet);
	const raiseBy = r.street < 2 ? bb : bb * 2;
	if (action === 'raise' && r.betCount < MAX_BETS) {
		const pay = r.toCall + raiseBy - r.invested[i];
		if (r.stacks[i] >= pay) {
			r.invested[i] += pay;
			r.stacks[i] -= pay;
			r.toCall += raiseBy;
			r.betCount++;
			r.freeActed = r.players.map(() => false);
			return;
		}
	}
	// call (or check when nothing owed)
	const pay = r.toCall - r.invested[i];
	if (pay > 0) {
		r.invested[i] += pay;
		r.stacks[i] -= pay;
	} else {
		r.freeActed[i] = true;
	}
}

export function holdemAct(id: string, player: string, action: 'fold' | 'check' | 'call' | 'raise'): HoldemRoom {
	const r = getRoom<HoldemRoom>(id, 'holdem');
	const seat = r.players.indexOf(player);
	if (seat < 0) throw err('you are not seated at this table');
	if (r.over) throw err('hand is over');
	if (!r.deck.length) throw err('waiting for players');
	if (r.current !== seat) throw err('not your turn');
	doAction(r, seat, action);
	advance(r);
	if (r.over) settle(r);
	return r;
}

function settle(r: HoldemRoom) {
	const rem = remaining(r);
	let winners: number[];
	if (rem.length === 1) {
		winners = rem;
	} else {
		let best = -1;
		winners = [];
		for (const s of rem) {
			const sc = bestOf5([...r.hole[s]!, ...r.board]);
			if (sc > best) {
				best = sc;
				winners = [s];
			} else if (sc === best) winners.push(s);
		}
	}
	const pot = r.invested.reduce((a, b) => a + b, 0);
	const share = Math.floor(pot / winners.length);
	winners.forEach((s) => (r.stacks[s] += share));
	r.stacks[winners[0]] += pot - share * winners.length; // rounding dust to first winner
	r.winners = winners;
	r.payouts = [...r.stacks]; // everyone already paid their buy-in on join
	r.over = true;
}

function holdemView(r: HoldemRoom, seat: number) {
	const started = !!r.deck.length;
	return {
		game: 'holdem' as const,
		roomId: r.id,
		bet: r.bet,
		started,
		you: seat,
		board: r.board.map(cardName),
		streetLabel: STREET_LABEL[r.street],
		pot: r.invested.reduce((a, b) => a + b, 0),
		toCall: r.toCall,
		callAmount: seat >= 0 ? Math.max(0, r.toCall - (r.invested[seat] ?? 0)) : 0,
		canAct: started && !r.over && seat >= 0 && r.current === seat,
		canRaise: r.betCount < MAX_BETS,
		over: r.over,
		winners: r.winners ?? null,
		payouts: r.payouts ?? null,
		seats: r.players.map((p, i) => ({
			wallet: p,
			isYou: i === seat,
			stack: r.stacks[i] ?? r.bet,
			invested: r.invested[i] ?? 0,
			folded: r.folded[i] ?? false,
			turn: started && !r.over && r.current === i,
			hole: r.hole[i] && (i === seat || r.over) ? r.hole[i].map(cardName) : null,
		})),
	};
}

// ---------------------------------------------------------------- shared view dispatch

export function view(game: 'chess' | 'holdem', id: string, player: string) {
	if (game === 'chess') return chessView(getRoom<ChessRoom>(id, 'chess'), player);
	const r = getRoom<HoldemRoom>(id, 'holdem');
	return holdemView(r, r.players.indexOf(player));
}
