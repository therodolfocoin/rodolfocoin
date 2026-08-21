<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { wallet, play } from '$lib/client/casino.svelte';

	let bet = $state(200);
	let busy = $state(false);
	let msg = $state('');
	let roomId = $state('');
	let view = $state<any>(null);
	let tables = $state<any[]>([]);

	const short = (w: string) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '');
	const f = (n: number) => Math.round(n).toLocaleString();

	$effect(() => {
		const t = setInterval(roomId ? poll : loadTables, 1500);
		if (!roomId) loadTables();
		return () => clearInterval(t);
	});

	async function loadTables() {
		try {
			const res = await fetch('/api/mp/holdem/list');
			tables = (await res.json()).rooms ?? [];
		} catch {
			// lobby refresh is best-effort
		}
	}

	function create() {
		busy = true;
		msg = '';
		play(bet, '/api/mp/holdem/create')
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
			const data = await play(t.bet, '/api/mp/holdem/join', { roomId: t.roomId });
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
			const res = await fetch(`/api/mp/holdem/state?id=${roomId}&player=${wallet.address}`);
			if (!res.ok) return;
			view = (await res.json()).view;
		} catch {
			// transient poll errors are fine
		}
	}

	async function actFn(action: 'fold' | 'check' | 'call' | 'raise') {
		busy = true;
		msg = '';
		try {
			const res = await fetch('/api/mp/holdem/act', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roomId, player: wallet.address, action }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || data.error || 'action failed');
			view = data.view;
		} catch (e) {
			msg = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<Card class="mx-auto max-w-3xl">
	<CardHeader>
		<CardTitle class="text-center text-2xl">🃏 Texas Hold&rsquo;em — Multiplayer</CardTitle>
		<CardDescription class="text-center">2–4 players, fixed-limit, one hand. Everyone buys in; final stacks get paid.</CardDescription>
	</CardHeader>
	<CardContent class="flex flex-col gap-5">
		{#if !roomId}
			<form class="flex items-end gap-3" onsubmit={(e) => { e.preventDefault(); create(); }}>
				<div class="flex flex-1 flex-col gap-2">
					<Label for="hb">Buy-in ($K)</Label>
					<Input id="hb" type="number" min="4" step="1" bind:value={bet} disabled={busy} />
				</div>
				<Button type="submit" size="lg" class="flex-1" disabled={busy || !wallet.connected}>CREATE TABLE</Button>
			</form>

			<div class="flex flex-col gap-2">
				<p class="text-sm text-muted-foreground">Open tables</p>
				{#each tables as t (t.roomId)}
					<div class="flex items-center justify-between rounded-lg border p-3">
						<div class="text-sm">
							<span class="font-mono">{short(t.host)}</span>
							<span class="ml-2 text-muted-foreground">{f(t.bet)} $K · {t.seats}/4 seated</span>
						</div>
						<Button size="sm" variant="outline" disabled={busy || !wallet.connected} onclick={() => join(t)}>Join</Button>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">No open tables — create one and share the room.</p>
				{/each}
			</div>
		{:else if !view.started}
			<div class="flex flex-col items-center gap-3 py-6">
				<p class="text-lg font-semibold">Waiting for players… ({view.seats.length}/4 seated)</p>
				<p class="text-xs text-muted-foreground">Room: <span class="font-mono">{roomId}</span></p>
				<p class="text-sm text-muted-foreground">The hand starts automatically once someone joins.</p>
			</div>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-2">
				<Badge variant="secondary">{view.streetLabel}</Badge>
				<Badge>Pot: {f(view.pot)} $K</Badge>
				{#if view.toCall > 0}<Badge variant="outline">to call: {f(view.toCall)}</Badge>{/if}
			</div>

			<div class="flex min-h-16 items-center gap-2">
				{#each view.board as c}
					{@render card(c)}
				{/each}
				{#if view.board.length === 0}<span class="text-sm text-muted-foreground">no community cards yet</span>{/if}
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each view.seats as seat (seat.wallet)}
					<div class="rounded-lg border p-3 {seat.turn ? 'ring-2 ring-primary' : ''}">
						<div class="mb-2 flex items-center justify-between">
							<p class="text-sm font-semibold {seat.folded ? 'text-muted-foreground line-through' : ''}">
								{seat.isYou ? 'You' : short(seat.wallet)}{seat.folded ? ' (folded)' : ''}{seat.turn ? ' · acting…' : ''}
							</p>
							<p class="text-xs text-muted-foreground">{f(seat.stack)} $K</p>
						</div>
						<div class="flex min-h-9 gap-2">
							{#if seat.hole}
								{#each seat.hole as c}{@render card(c)}{/each}
							{:else}
								<span class="text-sm text-muted-foreground">? cards</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			{#if view.canAct && !view.over}
				<div class="flex flex-wrap gap-2">
					<Button variant="destructive" disabled={busy} onclick={() => actFn('fold')}>Fold</Button>
					<Button variant="outline" disabled={busy} onclick={() => actFn('check')}>Check</Button>
					<Button variant="outline" disabled={busy || view.callAmount === 0} onclick={() => actFn('call')}>
						Call {view.callAmount > 0 ? f(view.callAmount) : ''}
					</Button>
					<Button disabled={busy || !view.canRaise} onclick={() => actFn('raise')}>Raise</Button>
				</div>
			{:else if !view.over}
				<p class="text-sm text-muted-foreground">Waiting for the other players…</p>
			{/if}

			{#if view.over}
				{@const mine = view.you >= 0 ? view.payouts?.[view.you] ?? 0 : 0}
				<div class="flex flex-col items-center gap-2">
					<p class="text-lg font-semibold {mine > view.bet ? 'text-primary' : 'text-muted-foreground'}">
						{mine > view.bet
							? `You cash out ${f(mine)} $K!`
							: mine === view.bet
								? 'You broke even.'
								: `You walk away with ${f(mine)} $K.`}
					</p>
					<Button
						variant="outline"
						onclick={() => {
							roomId = '';
							view = null;
							loadTables();
						}}>Back to lobby</Button
					>
				</div>
			{/if}

			{#if msg && !view.over}<p class="text-sm text-destructive">{msg}</p>{/if}
		{/if}
	</CardContent>
</Card>

{#snippet card(name: string)}
	<div
		class="flex h-20 w-14 flex-col justify-between rounded-lg border bg-background p-1.5 shadow"
		class:text-red-500={['♥', '♦'].includes(name.slice(-1))}
	>
		<span class="text-base font-bold leading-none">{name.slice(0, -1)}</span>
		<span class="self-end text-lg leading-none">{name.slice(-1)}</span>
	</div>
{/snippet}
