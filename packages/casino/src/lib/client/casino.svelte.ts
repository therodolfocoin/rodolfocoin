import { betTx, casinoInfo, detectWallet, isAddress, pubkeyToAddress, walletConnect, walletDisconnect } from './solana';

export const wallet = $state({
  address: '',
  connected: false,
  balance: 0,
  mint: '',
  collector: '',
  decimals: 6,
  error: '',
  busy: false,
  visible: false,
});

let timer: ReturnType<typeof setInterval> | null = null;

// returns a stop function; call from your layout's onMount
export function startPolling() {
  syncDetected();
  refresh();
  timer = setInterval(() => { syncDetected(); refresh(); }, 8000);
  return () => { if (timer) { clearInterval(timer); timer = null; } };
}

function detectedPubkey(): string {
  const addr = pubkeyToAddress(detectWallet()?.publicKey);
  return isAddress(addr) ? addr : '';
}

function syncDetected() {
  wallet.visible = !!detectWallet();
  const pk = detectedPubkey();
  if (pk && !wallet.connected) {
    wallet.address = pk;
    wallet.connected = true;
  }
  if (!pk && wallet.connected) {
    wallet.address = '';
    wallet.connected = false;
    wallet.balance = 0;
  }
}

export async function connect() {
  if (wallet.busy) return;
  wallet.busy = true;
  wallet.error = '';
  try {
    const addr = await walletConnect();
    if (!isAddress(addr)) throw new Error('wallet did not return a valid address');
    wallet.address = addr;
    wallet.connected = true;
    await refresh();
  } catch (e) {
    wallet.error = e instanceof Error ? e.message : String(e);
  } finally {
    wallet.busy = false;
  }
}

export async function disconnect() {
  await walletDisconnect();
  wallet.address = '';
  wallet.connected = false;
  wallet.balance = 0;
}

export async function refresh() {
  try {
    const info = await casinoInfo();
    wallet.mint = info.mint;
    wallet.collector = info.collector;
    wallet.decimals = info.decimals;
    if (wallet.address) {
      const res = await fetch('/api/casino?wallet=' + encodeURIComponent(wallet.address));
      const data = await res.json();
      if (data.balance !== null && data.balance !== undefined) wallet.balance = data.balance;
    }
  } catch (e) {
    wallet.error = e instanceof Error ? e.message : String(e);
  }
}

// sign the real bet transfer then call the game endpoint
export async function play(bet: number, path: string, extra: Record<string, unknown> = {}) {
  if (!wallet.address) throw new Error('connect a wallet first');
  if (bet <= 0) throw new Error('bet must be positive');
  const sig = await betTx(wallet.mint, wallet.collector, wallet.address, bet, wallet.decimals);
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bet, player: wallet.address, betTx: sig, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'game call failed');
  return data;
}
