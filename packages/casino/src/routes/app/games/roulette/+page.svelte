<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { wallet, play } from '$lib/client/casino.svelte';

	let bet = $state(10);
	let pick = $state<string>('red');
	let busy = $state(false);
	let spinning = $state(false);
	let result = $state<{ number: number; color: string; win: number } | null>(null);
	let tx = $state('');

	// classic table layout: 3 rows of 12
	const ROWS = [
		[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
		[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
		[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
	];
	const colorOf = (n: number) => (n === 0 ? 'green' : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n) ? 'red' : 'black');

	const OUTSIDE: { pick: string; label: string; odds: string }[] = [
		{ pick: 'low', label: '1–18', odds: '2×' },
		{ pick: 'even', label: 'EVEN', odds: '2×' },
		{ pick: 'red', label: 'RED', odds: '2×' },
		{ pick: 'black', label: 'BLACK', odds: '2×' },
		{ pick: 'odd', label: 'ODD', odds: '2×' },
		{ pick: 'high', label: '19–36', odds: '2×' },
		{ pick: 'd1', label: '1st 12', odds: '3×' },
		{ pick: 'd2', label: '2nd 12', odds: '3×' },
		{ pick: 'd3', label: '3rd 12', odds: '3×' },
	];

	async function spinIt() {
		busy = true;
		spinning = true;
		result = null;
		try {
			const data = await play(bet, '/api/games/roulette/spin', { pick });
			setTimeout(() => {
				spinning = false;
				result = data;
				tx = data.payoutTx || '';
				busy = false;
			}, 800);
		} catch (e) {
			spinning = false;
			busy = false;
			result = { number: -1, color: '', win: -1 };
			alert(e instanceof Error ? e.message : String(e));
		}
	}
</script>

<Card class="mx-auto max-w-2xl">
	<CardHeader>
		<CardTitle class="text-center text-2xl">🎡 Roulette</CardTitle>
		<CardDescription class="text-center">Single zero. Straight up pays 36×. Zero eats every outside bet.</CardDescription>
	</CardHeader>
	<CardContent class="flex flex-col items-center gap-6">
		<div class="flex h-20 items-center justify-center gap-4" aria-live="polite">
			{#if spinning}
				<span class="animate-pulse text-5xl">🎡</span>
			{:else if result && result.number >= 0}
				<div class="flex animate-in zoom-in-95 flex-col items-center gap-1">
					<span class="flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl font-bold text-white {result.color === 'red' ? 'bg-red-600' : result.color === 'black' ? 'bg-neutral-900' : 'bg-green-600'}">
						{result.number}
					</span>
					<p class="font-semibold {result.win > 0 ? 'text-primary' : 'text-muted-foreground'}">
						{result.win > 0 ? `You win ${result.win.toLocaleString()} $K!` : 'The house keeps it.'}
					</p>
					{#if tx}<p class="text-xs text-muted-foreground">paid: <span class="font-mono">{tx.slice(0, 12)}…</span></p>{/if}
				</div>
			{:else if result}
				<p class="text-sm text-destructive">Spin failed.</p>
			{:else}
				<span class="text-5xl opacity-40">🎡</span>
			{/if}
		</div>

		<div class="grid w-full grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1">
			<button
				type="button"
				class="row-span-3 rounded border text-sm font-bold transition-colors {pick === '0'
					? 'border-primary ring-2 ring-primary'
					: ''} bg-green-700 text-white hover:brightness-110"
				onclick={() => (pick = '0')}
				disabled={busy}
			>
				0
			</button>
			{#each ROWS as row}
				{#each row as n}
					<button
						type="button"
						class="rounded border py-2 text-sm font-bold transition-colors {pick === String(n)
							? 'border-primary ring-2 ring-primary'
							: ''} {colorOf(n) === 'red' ? 'bg-red-700 text-white' : 'bg-neutral-900 text-white'} hover:brightness-125"
						onclick={() => (pick = String(n))}
						disabled={busy}
					>
						{n}
					</button>
				{/each}
			{/each}
		</div>

		<div class="grid w-full grid-cols-3 gap-1 sm:grid-cols-9">
			{#each OUTSIDE as o}
				<Button
					type="button"
					variant={pick === o.pick ? 'default' : 'outline'}
					size="sm"
					class="text-xs"
					onclick={() => (pick = o.pick)}
					disabled={busy}
				>
					{o.label} <span class="opacity-60">{o.odds}</span>
				</Button>
			{/each}
		</div>

		<form class="flex w-full items-end gap-3" onsubmit={(e) => { e.preventDefault(); spinIt(); }}>
			<div class="flex flex-1 flex-col gap-2">
				<Label for="bet">Bet ($K)</Label>
				<Input id="bet" type="number" min="1" step="1" bind:value={bet} disabled={busy} />
			</div>
			<Button type="submit" size="lg" disabled={busy || !wallet.connected} class="flex-1">
				{spinning ? 'Spinning…' : `SPIN (${pick})`}
			</Button>
		</form>
		{#if !wallet.connected}
			<p class="text-sm text-muted-foreground">Connect a devnet wallet up top to play.</p>
		{/if}
	</CardContent>
</Card>
