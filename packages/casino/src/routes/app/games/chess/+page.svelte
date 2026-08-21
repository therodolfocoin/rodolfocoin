<script lang="ts">
	import { Chess, type Square } from 'chess.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { wallet, play } from '$lib/client/casino.svelte';

	let bet = $state(50);
	let color = $state<'w' | 'b'>('w');
	let busy = $state(false);
	let token = $state('');
	let fen = $state('');
	let over = $state(false);
	let msg = $state('');
	let tx = $state('');
	let selected = $state('');
	let targets = $state<string[]>([]);
	let aiFlash = $state<{ from: string; to: string } | null>(null);

	let game: Chess = new Chess();

	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const GLYPH: Record<string, string> = {
		k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
		K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
	};

	function resetView() {
		selected = '';
		targets = [];
		aiFlash = null;
	}

	function startGame() {
		busy = true;
		msg = '';
		tx = '';
		over = false;
		resetView();
		play(bet, '/api/games/chess/start', { color })
			.then((data) => {
				token = data.token;
				fen = data.fen;
				game = new Chess(data.fen);
				if (data.ai) flashAi(data.ai);
			})
			.catch((e) => (msg = e instanceof Error ? e.message : String(e)))
			.finally(() => (busy = false));
	}

	function flashAi(m: { from: string; to: string }) {
		aiFlash = m;
		setTimeout(() => (aiFlash = null), 900);
	}

	// cells are iterated 0..7 on both axes; views use color-aware orientation
	function cellSquare(rIdx: number, fIdx: number) {
		return FILES[color === 'w' ? fIdx : 7 - fIdx] + (color === 'w' ? 8 - rIdx : rIdx + 1);
	}
	function cellPiece(rIdx: number, fIdx: number) {
		return game.board()[color === 'w' ? rIdx : 7 - rIdx][color === 'w' ? fIdx : 7 - fIdx];
	}
	function cellDark(rIdx: number, fIdx: number) {
		const r = color === 'w' ? rIdx : 7 - rIdx;
		const f = color === 'w' ? fIdx : 7 - fIdx;
		return (r + f) % 2 === 1;
	}

	function onSquare(rIdx: number, fIdx: number) {
		if (over || !token) return;
		const sq = cellSquare(rIdx, fIdx);
		if (selected) {
			if (targets.includes(sq)) {
				move(selected, sq);
			} else {
				selected = '';
				targets = [];
			}
			return;
		}
		if (game.turn() === color) {
			const p = cellPiece(rIdx, fIdx);
			if (p && p.color === color) {
				selected = sq;
				targets = (game.moves({ square: sq as Square, verbose: true }) as Array<{ to: string }>).map((m) => m.to);
			}
		}
	}

	async function move(from: string, to: string) {
		busy = true;
		msg = '';
		tx = '';
		resetView();
		try {
			const res = await fetch('/api/games/chess/move', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, from, to }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'illegal move');
			token = data.token;
			fen = data.fen;
			game = new Chess(data.fen);
			if (data.ai) flashAi(data.ai);
			if (data.over) {
				over = true;
				const r = data.result;
				if (r.out === 'win') msg = `Checkmate — you win +${Math.round(data.payout).toLocaleString()} $K!`;
				else if (r.out === 'draw') msg = `Draw (${r.reason}) — your ${Math.round(data.payout).toLocaleString()} $K comes back.`;
				else msg = `The house wins (${r.reason}). It keeps the ${Math.round((data.result?.payout ?? 0)).toLocaleString()} $K.`;
				tx = data.payoutTx || '';
			}
		} catch (e) {
			msg = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<Card class="mx-auto max-w-xl">
	<CardHeader>
		<CardTitle class="text-center text-2xl">♞ Chess</CardTitle>
		<CardDescription class="text-center">Win 2×, draw returns your bet, loss goes to the house.</CardDescription>
	</CardHeader>
	<CardContent class="flex flex-col gap-5">
		{#if !token}
			<form class="flex flex-col gap-3" onsubmit={(e) => { e.preventDefault(); startGame(); }}>
				<div class="grid grid-cols-2 gap-3">
					<div class="flex flex-col gap-2">
						<Label for="cb">Bet ($K)</Label>
						<Input id="cb" type="number" min="1" step="1" bind:value={bet} disabled={busy} />
					</div>
					<div class="flex flex-col gap-2">
						<Label for="col">Play as</Label>
						<select
							id="col"
							bind:value={color}
							class="h-9 w-full rounded-md border bg-background px-3 text-sm"
							disabled={busy}
						>
							<option value="w">White (moves first)</option>
							<option value="b">Black (house moves first)</option>
						</select>
					</div>
				</div>
				<Button type="submit" size="lg" disabled={busy || !wallet.connected}>START</Button>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<Badge variant="secondary">{color === 'w' ? 'White' : 'Black'} to move</Badge>
				{#if aiFlash}<Badge variant="outline">house: {aiFlash.from}→{aiFlash.to}</Badge>{/if}
			</div>

			<div class="mx-auto grid aspect-square w-full max-w-sm grid-cols-8 overflow-hidden rounded-lg border shadow" aria-label="chess board">
				{#each Array.from({ length: 8 }) as _, rIdx}
					{#each Array.from({ length: 8 }) as _, fIdx}
						{@const sq = cellSquare(rIdx, fIdx)}
						{@const p = cellPiece(rIdx, fIdx)}
						<button
							type="button"
							class="relative flex items-center justify-center text-3xl leading-none transition-colors {cellDark(rIdx, fIdx)
								? 'bg-[oklch(0.42_0.05_160)]'
								: 'bg-[oklch(0.88_0.02_95)]'} {sq === selected ? 'ring-2 ring-inset ring-yellow-400' : ''}"
							onclick={() => onSquare(rIdx, fIdx)}
						>
							{#if p}<span class="select-none {p.color === 'w' ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-black'}">{GLYPH[p.type]}</span>{/if}
							{#if targets.includes(sq)}<span class="absolute inset-0 bg-yellow-400/30"></span>{/if}
							{#if aiFlash && sq === aiFlash.from}<span class="absolute inset-0 bg-red-400/40"></span>{/if}
							{#if aiFlash && sq === aiFlash.to}<span class="absolute inset-0 bg-yellow-400/50"></span>{/if}
						</button>
					{/each}
				{/each}
			</div>

			{#if over}
				<div class="flex flex-col items-center gap-2">
					<p class="text-lg font-semibold {msg.includes('win') ? 'text-primary' : 'text-muted-foreground'}">{msg}</p>
					{#if tx}<p class="text-xs text-muted-foreground">paid: <span class="font-mono">{tx.slice(0, 12)}…</span></p>{/if}
					<Button onclick={startGame} disabled={busy}>Play again</Button>
				</div>
			{:else}
				<p class="text-center text-sm text-muted-foreground">
					{busy ? 'The house is thinking…' : 'Select a piece, then a highlighted square. Click a target to move.'}
				</p>
			{/if}

			{#if msg && !over}<p class="text-center text-sm text-destructive">{msg}</p>{/if}
		{/if}
	</CardContent>
</Card>
