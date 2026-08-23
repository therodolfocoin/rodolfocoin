<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { wallet, connect, disconnect, startPolling } from '$lib/client/casino.svelte';
	import { addressShort } from '$lib/client/solana';

	let { children } = $props();

	onMount(() => startPolling());

	const links = [
		{ href: '/', label: 'Lobby' },
		{ href: '/app/games/slots', label: 'Slots' },
		{ href: '/app/games/blackjack', label: 'Blackjack' },
		{ href: '/app/games/roulette', label: 'Roulette' },
		{ href: '/app/games/holdem', label: 'Texas Hold\u2019em' },
		{ href: '/app/games/chess', label: 'Chess' },
	];
</script>

<div class="flex min-h-dvh flex-col">
	<header class="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
			<a href="/" class="flex items-center gap-2 text-lg font-semibold tracking-tight">
				<span class="text-2xl">🎰</span> RODOLFO CASINO
			</a>
			<nav class="flex flex-wrap items-center gap-1">
				{#each links as link}
					<a href={link.href} class="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{link.label}</a>
				{/each}
			</nav>
			<div class="ml-auto flex flex-wrap items-center gap-2">
				{#if wallet.connected}
					<Badge variant="secondary" class="font-mono">{addressShort(wallet.address)}</Badge>
					<Badge class="bg-primary text-primary-foreground" title="on-chain $K balance">
						🪙 {wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $K
					</Badge>
					<Button size="sm" variant="outline" onclick={disconnect}>Disconnect</Button>
				{:else}
					{#if wallet.visible}
						<Button size="sm" onclick={connect}>Connect wallet</Button>
					{:else}
						<Button size="sm" variant="outline" href="https://phantom.app/" target="_blank" rel="noreferrer">Install Phantom</Button>
					{/if}
				{/if}
			</div>
		</div>
		{#if wallet.error}
			<div class="mx-auto max-w-6xl px-4 pb-2 text-sm text-destructive">{wallet.error}</div>
		{/if}
	</header>

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="border-t py-4 text-center text-xs text-muted-foreground">
		Devnet only. House keeps the rake. No refunds. <span class="text-primary">$K for the people.</span>
	</footer>
</div>
