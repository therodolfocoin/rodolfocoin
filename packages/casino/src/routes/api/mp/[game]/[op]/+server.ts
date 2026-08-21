import { json, error } from '@sveltejs/kit';
import { isValidSolanaAddress, payOut } from '$lib/server/solana';
import { parseBet, requireConfirmedBet } from '$lib/server/validate';
import {
	chessMove,
	createChess,
	createHoldem,
	holdemAct,
	joinChess,
	joinHoldem,
	openRooms,
	view,
	type HoldemRoom,
} from '$lib/server/mp';

// ponytail: identity is the claimed wallet pubkey in the request body — same
// trust model as every other game here; real auth would sign each action
const GAMES = ['chess', 'holdem'] as const;
type Game = (typeof GAMES)[number];

function game(p: string): Game {
	if (!GAMES.includes(p as Game)) throw error(404, 'unknown game');
	return p as Game;
}

function roomId(body: Record<string, unknown> | undefined): string {
	const id = body?.roomId;
	if (typeof id !== 'string' || id.length < 8) throw error(400, 'missing roomId');
	return id;
}

function player(body: Record<string, unknown> | undefined): string {
	const p = body?.player;
	if (typeof p !== 'string' || !isValidSolanaAddress(p)) throw error(400, 'invalid player wallet address');
	return p;
}

export async function GET({ params, url }) {
	const g = game(params.game ?? '');
	if (params.op === 'list') return json({ rooms: openRooms(g) });
	if (params.op !== 'state') throw error(404, 'unknown op');
	const id = url.searchParams.get('id') ?? '';
	const player = url.searchParams.get('player') ?? '';
	if (player && !isValidSolanaAddress(player)) throw error(400, 'invalid player wallet address');
	try {
		return json({ view: view(g, id, player) });
	} catch (e) {
		throw error((e as { status?: number }).status ?? 400, (e as Error).message);
	}
}

export async function POST({ params, request }) {
	try {
		return await handle(params, request);
	} catch (e) {
		if ((e as { status?: number }).status && (e as Error).message) throw error((e as { status: number }).status, (e as Error).message);
		throw e;
	}
}

async function handle(params: Record<string, string>, request: Request) {
	const g = game(params.game ?? '');
	const body = await request.json().catch(() => ({}));

	if (params.op === 'create') {
		const { bet, player, betTx } = parseBet(body);
		await requireConfirmedBet(betTx);
		const room = g === 'chess' ? createChess(player, bet) : createHoldem(player, bet);
		return json({ roomId: room.id, view: view(g, room.id, player) });
	}

	if (params.op === 'join') {
		const id = roomId(body);
		const { bet, player, betTx } = parseBet(body);
		await requireConfirmedBet(betTx);
		if (g === 'chess') joinChess(id, player, bet);
		else joinHoldem(id, player, bet);
		return json({ roomId: id, view: view(g, id, player) });
	}

	if (g === 'chess' && params.op === 'move') {
		const id = roomId(body);
		const p = player(body);
		const from = body?.from;
		const to = body?.to;
		if (typeof from !== 'string' || typeof to !== 'string') throw error(400, 'expected from/to squares');
		const room = chessMove(id, p, from, to);
		let payoutTx: string[] = [];
		if (room.outcome && !room.paid) {
			room.paid = true;
			payoutTx = (
				await Promise.all([payOut(room.white, room.outcome.payouts.w), payOut(room.black!, room.outcome.payouts.b)])
			).filter((s): s is string => !!s);
		}
		return json({ view: view('chess', id, p), payoutTx });
	}

	if (g === 'holdem' && params.op === 'act') {
		const id = roomId(body);
		const p = player(body);
		const action = body?.action;
		if (action !== 'fold' && action !== 'check' && action !== 'call' && action !== 'raise')
			throw error(400, 'invalid action');
		const room = holdemAct(id, p, action);
		let payoutTx: string[] = [];
		if (room.over && room.payouts && !room.paidAll) {
			room.paidAll = true;
			payoutTx = (
				await Promise.all(room.players.map((pl, i) => payOut(pl, (room as HoldemRoom).payouts![i])))
			).filter((s): s is string => !!s);
		}
		return json({ view: view('holdem', id, p), payoutTx });
	}

	throw error(404, 'unknown op');
}
