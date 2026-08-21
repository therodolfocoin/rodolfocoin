<script lang="ts">
	import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	const games = [
		{
			href: '/app/games/slots',
			emoji: '🎰',
			title: 'Slots',
			desc: 'Pull the lever. Three of a kind pays. Houses love you.',
			tag: 'Instant',
		},
		{
			href: '/app/games/blackjack',
			emoji: '🂡',
			title: 'Blackjack',
			desc: '21 beats the dealer. The dealer flinches below 17.',
			tag: 'Table',
		},
		{
			href: '/app/games/holdem',
			emoji: '🃏',
			title: 'Texas Hold\u2019em',
			desc: '4-handed fixed-limit vs three house bots that bluff sometimes.',
			tag: 'Bots',
		},
		{
			href: '/app/games/chess',
			emoji: '♞',
			title: 'Chess',
			desc: 'Bet on the long game. The house AI is greedy but beatable.',
			tag: 'Skill',
		},
		{
			href: '/app/games/holdem-mp',
			emoji: '👥',
			title: 'Hold\u2019em Multiplayer',
			desc: 'Real opponents, real money. 2–4 players, one hand, winner takes the pot.',
			tag: 'PvP',
		},
		{
			href: '/app/games/chess-mp',
			emoji: '⚔️',
			title: 'Chess Multiplayer',
			desc: 'Both ante, winner takes all. Create a table or join an open one.',
			tag: 'PvP',
		},
	];
</script>

<div class="flex flex-col gap-8">
	<section class="flex flex-col gap-3">
		<h1 class="text-3xl font-bold tracking-tight">Welcome to the house.</h1>
		<p class="max-w-2xl text-muted-foreground">
			Everything settles in real <span class="font-semibold text-primary">$K</span> on Solana devnet: your wallet pays
			its bet on-chain, the bankroll pays your winnings back. Bring your own <span class="font-semibold">$K</span> —
			grab some from the Rodolfocoin mint app, no printing here.
		</p>
	</section>

	<section class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each games as game}
			<Card class="transition-colors hover:border-primary">
				<CardHeader>
					<div class="flex items-center justify-between">
						<span class="text-4xl">{game.emoji}</span>
						<Badge variant="secondary">{game.tag}</Badge>
					</div>
					<CardTitle class="text-xl">{game.title}</CardTitle>
					<CardDescription>{game.desc}</CardDescription>
				</CardHeader>
				<CardFooter>
					<Button variant="outline" href={game.href}>Play {game.title}</Button>
				</CardFooter>
			</Card>
		{/each}
	</section>

	<section class="rounded-lg border p-5 text-sm text-muted-foreground">
		<p class="mb-2 font-semibold text-foreground">House rules</p>
		<ul class="list-disc space-y-1 pl-5">
			<li>Bets are real SPL transfers to the collector wallet; payouts come from the casino bankroll. Devnet money, real signatures, fixed supply — no minting.</li>
			<li>Slots: triple = ×120…×1.5; a pair pays 0.2×.</li>
			<li>Blackjack pays 2× (blackjack 2.5×); pushes return your bet.</li>
			<li>Hold'em: fixed-limit, small blind = 1% of buy-in, big blind = 2%.</li>
			<li>Chess: win 2×, draw returns your bet, loss keeps it with the house.</li>
		</ul>
	</section>
</div>
