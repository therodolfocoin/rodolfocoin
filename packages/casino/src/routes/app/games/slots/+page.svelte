<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { wallet, play } from '$lib/client/casino.svelte';

	let bet = $state(10);
	let busy = $state(false);
	let spinning = $state(false);
	let reels = $state(['❓', '❓', '❓']);
	let result = $state('');
	let lastWin: number | null = $state(null);
	let tx = $state('');

	async function spinIt() {
		busy = true;
		spinning = true;
		result = '';
		lastWin = null;
		reels = ['❓', '❓', '❓'];
		try {
			const data = await play(bet, '/api/games/slots/spin');
			setTimeout(() => {
				reels = data.reels;
				spinning = false;
				lastWin = data.win;
				result = data.win > 0 ? `You win ${data.win.toLocaleString()} $K!` : 'The house keeps it. Try again.';
				tx = data.payoutTx || '';
			}, 600);
		} catch (e) {
			spinning = false;
			result = e instanceof Error ? e.message : String(e);
			busy = false;
		}
	}
</script>

<Card class="mx-auto max-w-lg">
	<CardHeader>
		<CardTitle class="text-center text-2xl">🎰 Slots</CardTitle>
		<CardDescription class="text-center">Triple = big. Pair = 0.2×. House always eats.</CardDescription>
	</CardHeader>
	<CardContent class="flex flex-col items-center gap-6">
		<div class="flex gap-3" aria-live="polite">
			{#each reels as reel, i}
				<div
					class="flex h-28 w-24 items-center justify-center rounded-lg border bg-muted text-5xl font-bold {spinning
						? 'animate-pulse'
						: 'animate-in zoom-in-95'}"
					style="transition-delay:{i * 80}ms"
				>
					{reel}
				</div>
			{/each}
		</div>

		{#if result}
			<div class="flex flex-col items-center gap-1">
				<p class="text-lg font-semibold {lastWin ? 'text-primary' : 'text-muted-foreground'}">{result}</p>
				{#if tx}<p class="text-xs text-muted-foreground">paid: <span class="font-mono">{tx.slice(0, 12)}…</span></p>{/if}
			</div>
		{/if}

		<form class="flex w-full items-end gap-3" onsubmit={(e) => { e.preventDefault(); spinIt(); }}>
			<div class="flex flex-col gap-2 flex-1">
				<Label for="bet">Bet ($K)</Label>
				<Input id="bet" type="number" min="1" step="1" bind:value={bet} disabled={busy} />
			</div>
			<Button type="submit" size="lg" disabled={busy || !wallet.connected} class="flex-1">
				{spinning ? 'Spinning…' : 'SPIN'}
			</Button>
		</form>
		{#if !wallet.connected}
			<p class="text-sm text-muted-foreground">Connect a devnet wallet up top, then Print yourself some $K.</p>
		{/if}
	</CardContent>
</Card>
