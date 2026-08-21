<script lang="ts">
	import { Chess, type Square } from 'chess.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { wallet, play } from '$lib/client/casino.svelte';
	import ChessBoard from '$lib/components/ChessBoard.svelte';

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
	let lastMove = $state<{ from: string; to: string } | null>(null);

	// ponytail: re-parsing the fen per render is fine at this size
	let game = $derived(fen ? new Chess(fen) : new Chess());
	let inCheck = $derived.by(() => {
		if (!fen || over) return '';
		try {
			return game.inCheck() ? game.turn() : '';
		} catch {
			return '';
		}
	});

	function resetView() {
		selected = '';
		targets = [];
		lastMove = null;
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
				if (data.ai) lastMove = data.ai;
			})
			.catch((e) => (msg = e instanceof Error ? e.message : String(e)))
			.finally(() => (busy = false));
	}

	function onSquare(sq: Square) {
		if (over || busy || !token) return;
		if (selected) {
			if (targets.includes(sq)) {
				move(selected, sq);
			} else {
				selected = '';
				targets = [];
			}
			return;
		}
		const p = game.get(sq);
		if (p && p.color === color && game.turn() === color) {
			selected = sq;
			targets = (game.moves({ square: sq, verbose: true }) as Array<{ to: string }>).map((m) => m.to);
		}
	}

	async function move(from: string, to: string) {
		busy = true;
		msg = '';
		tx = '';
		selected = '';
		targets = [];
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
			lastMove = data.ai ?? { from, to };
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
		<CardTitle class="text-center text-2xl">Chess</CardTitle>
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
				<Badge variant="secondary">{color === 'w' ? 'White' : 'Black'} · you</Badge>
				<Badge variant={game.turn() === color ? 'default' : 'outline'}>
					{game.turn() === color ? 'Your move' : 'House thinking…'}
				</Badge>
			</div>

			<div class="mx-auto w-full max-w-sm">
				<ChessBoard
					{fen}
					orientation={color}
					{selected}
					{targets}
					{lastMove}
					check={inCheck as 'w' | 'b' | ''}
					disabled={busy || over}
					onsquare={onSquare}
				/>
			</div>

			{#if over}
				<div class="flex flex-col items-center gap-2">
					<p class="text-lg font-semibold {msg.includes('win') ? 'text-primary' : 'text-muted-foreground'}">{msg}</p>
					{#if tx}<p class="text-xs text-muted-foreground">paid: <span class="font-mono">{tx.slice(0, 12)}…</span></p>{/if}
					<Button onclick={startGame} disabled={busy}>Play again</Button>
				</div>
			{:else}
				<p class="text-center text-sm text-muted-foreground">
					{busy ? 'The house is thinking…' : 'Tap a piece, then a highlighted square.'}
				</p>
			{/if}

			{#if msg && !over}<p class="text-center text-sm text-destructive">{msg}</p>{/if}
		{/if}
	</CardContent>
</Card>
