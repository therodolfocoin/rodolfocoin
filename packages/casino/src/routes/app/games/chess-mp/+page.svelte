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
	let busy = $state(false);
	let msg = $state('');
	let roomId = $state('');
	let view = $state<any>(null);
	let tables = $state<any[]>([]);
	let selected = $state('');
	let targets = $state<string[]>([]);
	let lastMove = $state<{ from: string; to: string } | null>(null);

	// ponytail: re-parsing the fen per render is fine at this size
	let game = $derived(view?.fen ? new Chess(view.fen) : new Chess());
	const color = $derived<'w' | 'b' | null>(view?.yourColor ?? null);
	const myTurn = $derived(!!color && view.joined && !view.over && view.turn === color);
	const inCheck = $derived.by(() => {
		if (!view?.fen || view.over) return '';
		try {
			return game.inCheck() ? game.turn() : '';
		} catch {
			return '';
		}
	});

	$effect(() => {
		if (!roomId) {
			const t = setInterval(loadTables, 3000);
			loadTables();
			return () => clearInterval(t);
		}
		const t = setInterval(poll, 1500);
		return () => clearInterval(t);
	});

	async function loadTables() {
		try {
			const res = await fetch('/api/mp/chess/list');
			tables = (await res.json()).rooms ?? [];
		} catch {
			// lobby refresh is best-effort
		}
	}

	function create() {
		busy = true;
		msg = '';
		play(bet, '/api/mp/chess/create')
			.then((data) => {
				roomId = data.roomId;
				view = data.view;
			})
			.catch((e) => (msg = e instanceof Error ? e.message : String(e)))
			.finally(() => (busy = false));
	}

	async function join(t: any) {
		busy = true;
		msg = '';
		try {
			const data = await play(t.bet, '/api/mp/chess/join', { roomId: t.roomId });
			roomId = data.roomId;
			view = data.view;
		} catch (e) {
			msg = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function poll() {
		if (!wallet.address || busy) return;
		try {
			const res = await fetch(`/api/mp/chess/state?id=${roomId}&player=${wallet.address}`);
			if (!res.ok) return;
			const data = await res.json();
			view = data.view;
		} catch {
			// transient poll errors are fine
		}
	}

	function onSquare(sq: Square) {
		if (!myTurn || busy) return;
		if (selected) {
			if (targets.includes(sq)) move(selected, sq);
			else {
				selected = '';
				targets = [];
			}
			return;
		}
		const p = game.get(sq);
		if (p && p.color === color) {
			selected = sq;
			targets = (game.moves({ square: sq, verbose: true }) as Array<{ to: string }>).map((m) => m.to);
		}
	}

	async function move(from: string, to: string) {
		busy = true;
		msg = '';
		selected = '';
		targets = [];
		try {
			const res = await fetch('/api/mp/chess/move', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roomId, player: wallet.address, from, to }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || data.error || 'illegal move');
			lastMove = { from, to };
			view = data.view;
		} catch (e) {
			msg = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	const short = (w: string) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '');
</script>

<Card class="mx-auto max-w-xl">
	<CardHeader>
		<CardTitle class="text-center text-2xl">Chess — Multiplayer</CardTitle>
		<CardDescription class="text-center">Both players ante. Winner takes the pot, draw splits it.</CardDescription>
	</CardHeader>
	<CardContent class="flex flex-col gap-5">
		{#if !roomId}
			<form class="flex items-end gap-3" onsubmit={(e) => { e.preventDefault(); create(); }}>
				<div class="flex flex-1 flex-col gap-2">
					<Label for="cb">Ante ($K)</Label>
					<Input id="cb" type="number" min="1" step="1" bind:value={bet} disabled={busy} />
				</div>
				<Button type="submit" size="lg" class="flex-1" disabled={busy || !wallet.connected}>CREATE TABLE</Button>
			</form>

			<div class="flex flex-col gap-2">
				<p class="text-sm text-muted-foreground">Open tables</p>
				{#each tables as t (t.roomId)}
					<div class="flex items-center justify-between rounded-lg border p-3">
						<div class="text-sm">
							<span class="font-mono">{short(t.host)}</span>
							<span class="ml-2 text-muted-foreground">{t.bet.toLocaleString()} $K</span>
						</div>
						<Button size="sm" variant="outline" disabled={busy || !wallet.connected} onclick={() => join(t)}>Join</Button>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">No open tables — create one.</p>
				{/each}
			</div>
		{:else}
			<div class="flex items-center justify-between">
				<Badge variant="secondary">
					{#if !view.joined}Waiting for an opponent…{:else}{myTurn ? 'Your move' : `${view.turn === 'w' ? 'White' : 'Black'} to move`}{/if}
				</Badge>
				<Badge>Pot: {(view.bet * 2).toLocaleString()} $K</Badge>
			</div>

			<div class="mx-auto w-full max-w-sm">
				<ChessBoard
					fen={view.fen}
					orientation={color ?? 'w'}
					{selected}
					{targets}
					{lastMove}
					check={inCheck as 'w' | 'b' | ''}
					disabled={!myTurn}
					onsquare={onSquare}
				/>
			</div>

			<p class="text-center text-xs text-muted-foreground">
				You are {color === 'w' ? 'White' : color === 'b' ? 'Black' : 'watching'} ·
				white {short(view.white)} vs black {short(view.black)}
			</p>

			{#if view.over && view.outcome}
				{@const o = view.outcome}
				<p class="text-center text-lg font-semibold {o.winner === color ? 'text-primary' : 'text-muted-foreground'}">
					{o.winner === null
						? `Draw (${o.reason}) — antes come back.`
						: o.winner === color
							? `You win ${(view.bet * 2).toLocaleString()} $K!`
							: `You lose — ${o.reason}.`}
				</p>
			{:else if !myTurn}
				<p class="text-center text-sm text-muted-foreground">Waiting for your opponent…</p>
			{/if}

			{#if msg}<p class="text-center text-sm text-destructive">{msg}</p>{/if}
		{/if}
	</CardContent>
</Card>
