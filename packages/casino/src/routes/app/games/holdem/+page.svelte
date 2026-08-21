<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { wallet, play } from '$lib/client/casino.svelte';

	let bet = $state(200);
	let busy = $state(false);
	let token = $state('');
	let view = $state<any>(null);
	let msg = $state('');
	let tx = $state('');

	const STREET_STEPS = ['pre-flop', 'flop', 'turn', 'river'];

	function deal() {
		busy = true;
		msg = '';
		tx = '';
		play(bet, '/api/games/holdem/deal')
			.then((data) => {
				token = data.token;
				view = data.view;
				if (data.over) end(data);
			})
			.catch((e) => (msg = e instanceof Error ? e.message : String(e)))
			.finally(() => (busy = false));
	}

	async function actFn(action: 'fold' | 'check' | 'call' | 'raise') {
		if (!token) return;
		busy = true;
		msg = '';
		tx = '';
		try {
			const res = await fetch('/api/games/holdem/act', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, action }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'action failed');
			token = data.token;
			view = data.view;
			if (data.over) end(data);
		} catch (e) {
			msg = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function end(data: any) {
		const r = data.view?.result;
		if (r) {
			if (r.playerNet > 0) msg = `You won ${Math.round(r.playerNet).toLocaleString()} $K!`;
			else if (r.playerNet === 0) msg = 'You broke even. The house respects that.';
			else msg = `You lost ${Math.round(-r.playerNet).toLocaleString()} $K. The house thanks you.`;
			tx = data.payoutTx || '';
		}
	}

	const f = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
</script>

<Card class="mx-auto max-w-3xl">
	<CardHeader>
		<CardTitle class="text-center text-2xl">🃏 Texas Hold&rsquo;em</CardTitle>
		<CardDescription class="text-center">Fixed-limit. You + 3 house bots. Blind 2% of buy-in.</CardDescription>
	</CardHeader>
	<CardContent class="flex flex-col gap-5">
		{#if !view}
			<form class="flex w-full items-end gap-3" onsubmit={(e) => { e.preventDefault(); deal(); }}>
				<div class="flex flex-col gap-2 flex-1">
					<Label for="bet">Buy-in ($K)</Label>
					<Input id="bet" type="number" min="4" step="1" bind:value={bet} disabled={busy} />
				</div>
				<Button type="submit" size="lg" class="flex-1" disabled={busy || !wallet.connected}>BUY IN</Button>
			</form>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-2">
				<Badge variant="secondary">{view.streetLabel}</Badge>
				<Badge>Pot: {f(view.pot)} $K</Badge>
				{#if view.toCall > 0}<Badge variant="outline">to call: {f(view.toCall)}</Badge>{/if}
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-sm text-muted-foreground">Table</p>
				<div class="flex min-h-16 items-center gap-2">
					{#each view.board as c}
						{@render card(c)}
					{/each}
					{#if view.board.length === 0}
						<span class="text-sm text-muted-foreground">no community cards yet</span>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="rounded-lg border p-3">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-semibold text-primary">You</p>
						<p class="text-xs text-muted-foreground">{f(view.stacks[0])} $K</p>
					</div>
					<div class="flex gap-2">
						{#each view.hole as c}
							{@render card(c)}
						{/each}
					</div>
				</div>
				{#each view.bots as bot, i}
					<div class="rounded-lg border p-3">
						<div class="mb-2 flex items-center justify-between">
							<p class="text-sm font-semibold {bot.folded ? 'text-muted-foreground line-through' : ''}">Bot {i + 1}{bot.folded ? ' (folded)' : ''}</p>
							<p class="text-xs text-muted-foreground">{f(bot.stacks)} $K</p>
						</div>
						<div class="flex min-h-9 gap-2">
							{#if view.over && bot.hole}
								{#each bot.hole as c}{@render card(c)}{/each}
							{:else}
								<span class="text-sm text-muted-foreground">{bot.hole ? 'showdown' : '? cards'}</span>
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
				<p class="text-sm text-muted-foreground">The bots are acting…</p>
			{/if}

			{#if view.over}
				<div class="flex flex-col items-center gap-2">
					{#if view.result?.winner && view.over}
						<p class="text-sm text-muted-foreground">Winner: {view.result.winner.includes(0) ? 'You' : `Bot ${view.result.winner[0]}`}</p>
					{/if}
					<p class="text-lg font-semibold {msg.includes('won') ? 'text-primary' : 'text-muted-foreground'}">{msg}</p>
					{#if tx}<p class="text-xs text-muted-foreground">paid: <span class="font-mono">{tx.slice(0, 12)}…</span></p>{/if}
					<Button onclick={deal} disabled={busy}>New hand</Button>
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
