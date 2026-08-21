# Rodolfocoins

A Solana devnet memecoin. $K for the people. Mint coins to any wallet from the web app, or on the CLI.

## Stack

- [Bun](https://bun.sh) + workspace monorepo
- `@rodolfocoins/coin-gen` — Solana + Metaplex token creation/minting (TypeScript, runs on Bun)
- `@rodolfocoins/web` — SvelteKit minting frontend
- `@rodolfocoins/casino` — SvelteKit + shadcn-svelte + Tailwind casino on devnet (slots, blackjack, Texas hold'em, chess)

## Setup

```sh
bun install
bun run dev   # web app
bun run casino  # casino app (packages/casino)
```

The wallet keypair is stored at `.keys/devnet.json` (gitignored) and created on first run.

## CLI

Create a new coin (airdrop-funds the wallet on devnet automatically):

```sh
bun run create
```

Burn the whole supply and reclaim rent:

```sh
bun run burn
```

## Casino

`bun run casino` then open the printed localhost URL with a Phantom wallet pointed at **devnet**. Everything settles in real `$K` SPL transfers on a **fixed-supply** coin (no minting in the casino):

- Bring your own `$K` (e.g. minted from the Rodolfocoin web app) — bets are signed transfers you make to the **collector wallet** (losses pile up there).
- Winnings are paid from the casino **bankroll** (the collector keypair at `packages/casino/.casino/collector.json`), so the house needs $K in that wallet.
- The canonical coin is `2kEZzHWT8qAUfGEH3RQp6km5wuQTqBqXbs6HTYzS6RPx`; `RODOLFOCOIN_MINT` overrides it.
- `CASINO_COLLECTOR` overrides where lost bets land. Without it, a per-machine collector/bankroll keypair is generated on first run at `packages/casino/.casino/collector.json` (gitignored).
- In `dev` mode, bet-tx confirmation is bypassed so the flow is clickable without a devnet wallet; production verifies the on-chain signature.
