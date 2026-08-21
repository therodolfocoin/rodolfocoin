<script lang="ts">
	import { Chess, type Square } from 'chess.js';

	interface Props {
		fen: string;
		orientation?: 'w' | 'b';
		selected?: string;
		targets?: string[];
		lastMove?: { from: string; to: string } | null;
		check?: 'w' | 'b' | '';
		disabled?: boolean;
		onsquare?: (sq: Square) => void;
	}

	let { fen, orientation = 'w', selected = '', targets = [], lastMove = null, check = '', disabled = false, onsquare }: Props = $props();

	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

	let board = $derived(new Chess(fen).board());
	let kingSquare = $derived.by(() => {
		if (!check) return '';
		for (const row of new Chess(fen).board())
			for (const p of row) if (p && p.type === 'k' && p.color === check) return p.square;
		return '';
	});

	function idx(rIdx: number, fIdx: number) {
		return orientation === 'w' ? [rIdx, fIdx] : [7 - rIdx, 7 - fIdx];
	}
	function squareAt(rIdx: number, fIdx: number): Square {
		const [r, f] = idx(rIdx, fIdx);
		return (FILES[f] + (8 - r)) as Square;
	}
	function pieceAt(rIdx: number, fIdx: number) {
		const [r, f] = idx(rIdx, fIdx);
		return board[r][f];
	}
</script>

<div class="grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border shadow select-none" aria-label="chess board">
	{#each Array.from({ length: 8 }) as _, rIdx}
		{#each Array.from({ length: 8 }) as __, fIdx}
			{@const sq = squareAt(rIdx, fIdx)}
			{@const p = pieceAt(rIdx, fIdx)}
			{@const dark = ((orientation === 'w' ? rIdx : 7 - rIdx) + (orientation === 'w' ? fIdx : 7 - fIdx)) % 2 === 1}
			<button
				type="button"
				tabindex={disabled || !onsquare ? -1 : 0}
				class="group relative flex items-center justify-center transition-colors {dark
					? 'bg-[oklch(0.45_0.06_160)]'
					: 'bg-[oklch(0.90_0.02_95)]'} {sq === selected ? 'ring-2 ring-inset ring-amber-400' : ''}"
				onclick={() => onsquare?.(sq)}
			>
				{#if sq === kingSquare}<span class="absolute inset-0 bg-red-500/50"></span>{/if}
				{#if lastMove && (sq === lastMove.from || sq === lastMove.to)}<span class="absolute inset-0 bg-amber-400/40"></span>{/if}
				{#if targets.includes(sq)}
					<span class="absolute {p ? 'inset-1 rounded-full border-4 border-emerald-950/50' : 'size-1/4 rounded-full bg-emerald-950/35'}"></span>
				{/if}
				{#if p}
					<img src="/piece/{p.color}{p.type.toUpperCase()}.svg" alt="{p.color} {p.type}" draggable="false" class="z-10 size-[85%] pointer-events-none drop-shadow-sm" />
				{/if}
			</button>
		{/each}
	{/each}
</div>
