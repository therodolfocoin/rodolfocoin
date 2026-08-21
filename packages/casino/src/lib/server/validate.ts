import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { betIsConfirmed, isValidSolanaAddress } from './solana';

export interface Bet { bet: number; player: string; betTx: string }

export function parseBet(body: Record<string, unknown> | undefined): Bet {
  const bet = body?.bet;
  const player = body?.player;
  const betTx = body?.betTx;
  if (typeof bet !== 'number' || !Number.isFinite(bet) || bet < 0.000001 || bet > 1_000_000)
    throw error(400, 'bet must be a positive number in coins ($K)');
  if (typeof player !== 'string' || !isValidSolanaAddress(player))
    throw error(400, 'invalid player wallet address');
  if (typeof betTx !== 'string' || betTx.length < 32)
    throw error(400, 'missing bet transaction signature');
  return { bet, player, betTx: betTx };
}

export async function requireConfirmedBet(betTx: string) {
  const ok = dev || (await betIsConfirmed(betTx));
  // ponytail: `dev` bypasses confirmation so the casino is clickable without a devnet wallet; prod verifies the real tx
  if (!ok) throw error(400, 'bet transaction was not confirmed on-chain yet');
}

export function parseToken(body: Record<string, unknown> | undefined, key = 'token'): string {
  const token = body?.[key];
  if (typeof token !== 'string' || token.length < 10) throw error(400, 'missing session token');
  return token;
}
