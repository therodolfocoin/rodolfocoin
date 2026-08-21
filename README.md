# Rodolfocoins

A Solana devnet memecoin. $K for the people. Mint coins to any wallet from the web app, or on the CLI.

## Stack

- [Bun](https://bun.sh) + workspace monorepo
- `@rodolfocoins/coin-gen` — Solana + Metaplex token creation/minting (TypeScript, runs on Bun)
- `@rodolfocoins/web` — SvelteKit minting frontend

## Setup

```sh
bun install
bun run dev   # web app
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
