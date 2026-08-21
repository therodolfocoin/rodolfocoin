<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { wallet, play } from '$lib/client/casino.svelte';

	let bet = $state(10);
	let busy = $state(false);
	let token = $state('');
	let view = $state<any>(null);
	let msg = $state('');
	let tx = $state('');

	function face(name: string) {
		const suit = name.slice(-1);
		const red = ['♥', '♦'].includes(suit);
		return { suit, red, rank: name.slice(0, -1) };
	}

	function start() {
		busy = true;
		msg = '';
		tx = '';
		play(bet, '/api/games/blackjack/deal')
			.then((data) => {
				token = data.token;
				view = data.view;
				if (data.win !== null && data.win !== undefined) {
					msg = `Blackjack! +${data.win.toLocaleString()} $K`;
					tx = data.payoutTx || '';
				}
			})
			.catch((e) => (msg = e instanceof Error ? e.message : String(e)))
			.finally(() => (busy = false));
	}

	async function act(path: string) {
		if (!token) return;
		busy = true;
		msg = '';
		tx = '';
		try {
			const res = await fetch(path, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'action failed');
			token = data.token;
			view = data.view;
			if (data.win !== null && data.win !== undefined) {
				msg = data.win > 0 ? `+${data.win.toLocaleString()} $K` : 'Bust / lost. The house smiles.';
				tx = data.payoutTx || '';
			}
		} catch (e) {
			msg = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<Card class="mx-auto max-w-2xl">
	<CardHeader>
		<CardTitle class="text-center text-2xl">🂡 Blackjack</CardTitle>
		<CardDescription class="text-center">Pays 2× (blackjack 2.5×). Pushes return your bet. Dealer stands on 17.</CardDescription>
	</CardHeader>
	<CardContent class="flex flex-col gap-6">
		{#if !view}
			<form class="flex w-full items-end gap-3" onsubmit={(e) => { e.preventDefault(); start(); }}>
				<div class="flex flex-col gap-2 flex-1">
					<Label for="bet">Bet ($K)</Label>
					<Input id="bet" type="number" min="1" step="1" bind:value={bet} disabled={busy} />
				</div>
				<Button type="submit" size="lg" class="flex-1" disabled={busy || !wallet.connected}>DEAL</Button>
			</form>
		{:else}
			<div class="flex flex-col gap-6">
				<div class="flex flex-col gap-2">
					<p class="text-sm text-muted-foreground">
						Dealer{view.dealerValue !== null ? ` (${view.dealerValue})` : ''}
					</p>
					<div class="flex min-h-24 flex-wrap items-center gap-2">
						{#each view.dealer as c}
							{@render card(c, false)}
						{/each}
						{#if view.dealerValue === null}
							<div class="flex h-24 w-16 items-center justify-center rounded-lg border-2 border-primary bg-primary/20 text-xl">🂠</div>
						{/if}
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<p class="text-sm text-muted-foreground">You ({view.playerValue})</p>
					<div class="flex min-h-24 flex-wrap items-center gap-2">
						{#each view.player as c}
							{@render card(c, true)}
						{/each}
					</div>
				</div>

				{#if view.phase === 'player'}
					<div class="flex gap-3">
						<Button variant="outline" class="flex-1" disabled={busy} onclick={() => act('/api/games/blackjack/hit')}>Hit</Button>
						<Button class="flex-1" disabled={busy} onclick={() => act('/api/games/blackjack/stand')}>Stand</Button>
					</div>
				{:else if msg}
					<div class="flex flex-col items-center gap-1">
						<p class="text-lg font-semibold text-primary">{msg}</p>
						{#if tx}<p class="text-xs text-muted-foreground">paid: <span class="font-mono">{tx.slice(0, 12)}…</span></p>{/if}
					</div>
					<Button onclick={start} disabled={busy}>Deal again</Button>
				{/if}
			</div>
		{/if}

		{#if msg && view?.phase === 'player'}
			<p class="text-sm text-destructive">{msg}</p>
		{/if}
	</CardContent>
</Card>

{#snippet card(name: string, up: boolean)}
	<div
		class="flex h-24 w-16 flex-col justify-between rounded-lg border bg-background p-2 shadow"
		class:text-red-500={up && face(name).red}
	>
		<span class="text-lg font-bold leading-none">{face(name).rank}</span>
		<span class="self-end text-xl leading-none">{face(name).suit}</span>
	</div>
{/snippet}
