import { rng, randomIntUpTo } from './solana';

// ---------------------------------------------------------------- slots
const SYMBOLS = [
  { id: '💎', w: 6, m: 120 },
  { id: '7', w: 12, m: 25 },
  { id: '$K', w: 22, m: 10 },
  { id: 'BAR', w: 30, m: 5 },
  { id: '🍒', w: 36, m: 3 },
  { id: '🍋', w: 46, m: 2 },
  { id: '🔔', w: 50, m: 1.5 },
] as const;
const totalW = SYMBOLS.reduce((a, s) => a + s.w, 0);

export interface SpinResult {
  reels: string[];
  win: number; // payout in whole coins (0 = lost)
}

export function spin(bet: number): SpinResult {
  const pick = () => {
    const r = rng() * totalW;
    let acc = 0;
    for (const s of SYMBOLS) {
      acc += s.w;
      if (r <= acc) return s.id;
    }
    return SYMBOLS[0].id;
  };
  const reels = [pick(), pick(), pick()];
  const [a, b, c] = reels;
  let win = 0;
  if (a === b && b === c) {
    win = bet * SYMBOLS.find((s) => s.id === a)!.m;
  } else if (a === b || b === c || a === c) {
    win = bet * 0.2;
  }
  return { reels, win: Math.round(win * 100) / 100 };
}

// ---------------------------------------------------------------- roulette (single zero)
export const ROULETTE_REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const rouletteColor = (n: number): 'green' | 'red' | 'black' =>
  n === 0 ? 'green' : ROULETTE_REDS.has(n) ? 'red' : 'black';

export type RoulettePick =
  | `${number}` // straight up 0-36, pays 36×
  | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' // even money, 2×
  | 'd1' | 'd2' | 'd3'; // dozens, 3×

export const isRoulettePick = (p: unknown): p is RoulettePick =>
  (typeof p === 'string' && /^\d+$/.test(p) && Number(p) <= 36) ||
  ['red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3'].includes(p as string);

export interface RouletteResult {
  number: number;
  color: 'green' | 'red' | 'black';
  win: number; // payout in whole coins (0 = lost)
}

export function roulette(bet: number, pick: RoulettePick): RouletteResult {
  const n = randomIntUpTo(37);
  const color = rouletteColor(n);
  let win = 0;
  if (/^\d+$/.test(pick)) {
    if (Number(pick) === n) win = bet * 36;
  } else if (n !== 0) {
    // 0 kills every outside bet
    const hit =
      (pick === 'red' && color === 'red') ||
      (pick === 'black' && color === 'black') ||
      (pick === 'odd' && n % 2 === 1) ||
      (pick === 'even' && n % 2 === 0) ||
      (pick === 'low' && n <= 18) ||
      (pick === 'high' && n >= 19) ||
      (pick === 'd1' && n <= 12) ||
      (pick === 'd2' && n > 12 && n <= 24) ||
      (pick === 'd3' && n > 24);
    if (hit) win = bet * (['d1', 'd2', 'd3'].includes(pick) ? 3 : 2);
  }
  return { number: n, color, win: Math.round(win * 100) / 100 };
}

// ---------------------------------------------------------------- blackjack
export type BJState = {
  id: string;
  player: string;
  bet: number;
  deck: number[];
  playerCards: number[];
  dealer: number[];
  phase: 'player' | 'done';
  win: number; // payout, set once phase === 'done'
};

const RANK = (n: number) => n % 13; // 0=A .. 12=K
const FACE = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT = ['♠', '♥', '♦', '♣'];
export const cardName = (n: number) => FACE[RANK(n)] + SUIT[Math.floor(n / 13)];

export const bjView = (s: BJState, revealed: boolean) => ({
  player: s.playerCards.map(cardName),
  dealer: (revealed ? s.dealer : s.dealer.slice(0, 1)).map(cardName),
  playerValue: hvalue(s.playerCards),
  dealerValue: revealed ? hvalue(s.dealer) : null,
  phase: s.phase,
  win: s.win,
});

function shuffle(deck: number[]): number[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomIntUpTo(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const newDeck = () => shuffle(Array.from({ length: 52 }, (_, i) => i));

export function hvalue(hand: number[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (RANK(c) === 0) aces++;
    else total += Math.min(RANK(c) + 1, 10);
  }
  for (let i = 0; i < aces; i++) total += total + 11 <= 21 ? 11 : 1;
  return total;
}

const isNatural = (h: number[]) => h.length === 2 && hvalue(h) === 21;

export function bjDeal(bet: number, player: string, id: string): { state: BJState; win: number | null } {
  const deck = newDeck();
  const playerCards = [deck.pop()!, deck.pop()!];
  const dealer = [deck.pop()!, deck.pop()!];
  // dealer peeks: a natural resolves the hand immediately
  if (isNatural(playerCards) && isNatural(dealer)) {
    const state = { id, player, bet, deck, playerCards, dealer, phase: 'done' as const, win: bet };
    return { state, win: bet };
  }
  if (isNatural(playerCards)) {
    const state = { id, player, bet, deck, playerCards, dealer, phase: 'done' as const, win: Math.round(bet * 2.5) };
    return { state, win: Math.round(bet * 2.5) };
  }
  return { state: { id, player, bet, deck, playerCards, dealer, phase: 'player', win: 0 }, win: null };
}

export function bjHit(s: BJState): { state: BJState; win: number | null } {
  if (s.phase !== 'player') throw Object.assign(new Error('hand is over'), { status: 400 });
  s.playerCards.push(s.deck.pop()!);
  if (hvalue(s.playerCards) > 21) {
    s.phase = 'done';
    s.win = 0;
    return { state: s, win: 0 };
  }
  return { state: s, win: null };
}

export function bjStand(s: BJState): { state: BJState; win: number } {
  if (s.phase !== 'player') throw Object.assign(new Error('hand is over'), { status: 400 });
  while (hvalue(s.dealer) < 17) s.dealer.push(s.deck.pop()!);
  const pv = hvalue(s.playerCards);
  const dv = hvalue(s.dealer);
  let win: number;
  if (dv > 21 || pv > dv) win = s.bet * 2;
  else if (pv === dv) win = s.bet;
  else win = 0;
  if (pv === 21 && s.playerCards.length === 2 && dv !== 21) win = Math.round(s.bet * 2.5);
  s.phase = 'done';
  s.win = win;
  return { state: s, win };
}

// ---------------------------------------------------------------- texas hold'em (fixed-limit, 1 player + 3 bots)
export interface HoldemState {
  id: string;
  player: string;
  bet: number; // buy-in
  deck: number[];
  board: number[];
  hole: (number[] | null)[];
  stacks: number[];
  invested: number[];
  folded: boolean[];
  street: 0 | 1 | 2 | 3 | 4; // 0 preflop, 1 flop, 2 turn, 3 river, 4 showdown
  current: number;
  toCall: number;
  betCount: number;
  freeActed: boolean[]; // per-street free check/option tracking
  over: boolean;
  result?: { winner: number[]; playerNet: number; payout: number };
}

const SEATS = [0, 1, 2, 3];
const MAX_BETS = 4;

export function bigBlind(bet: number) {
  return Math.max(1, Math.round(bet * 0.02));
}

export function holdemDeal(bet: number, player: string, id: string): HoldemState {
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
  const hole = SEATS.map(() => [deck.pop()!, deck.pop()!]);
  const bb = bigBlind(bet);
  const sb = Math.max(1, Math.floor(bb / 2));
  const invested = [0, sb, bb, 0];
  const stacks = SEATS.map((s) => bet - invested[s]);
  return {
    id,
    player,
    bet,
    deck,
    board: [],
    hole,
    stacks,
    invested,
    folded: [false, false, false, false],
    street: 0,
    current: 3, // UTG acts first preflop; player (seat 0, button) acts last
    toCall: bb,
    betCount: 1,
    freeActed: [false, false, false, false],
    over: false,
  };
}

export function bestOf5(cards: number[]): number {
  let best = -1;
  for (let i = 0; i < cards.length - 4; i++)
    for (let j = i + 1; j < cards.length - 3; j++)
      for (let k = j + 1; k < cards.length - 2; k++)
        for (let l = k + 1; l < cards.length - 1; l++)
          for (let m = l + 1; m < cards.length; m++)
            best = Math.max(best, five(cards[i], cards[j], cards[k], cards[l], cards[m]));
  return best;
}

function five(...cs: number[]): number {
  // 0-based rank -> poker rank (A=14, K=13 ... 2=2)
  const ranks = cs.map((c) => { const r = (c % 13) + 1; return r === 1 ? 14 : r; }).sort((a, b) => b - a);
  const suits = cs.map((c) => Math.floor(c / 13));
  const groups = new Map<number, number>();
  for (const r of ranks) groups.set(r, (groups.get(r) ?? 0) + 1);
  const byCount = [...groups.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = suits.every((s) => s === suits[0]);
  const straight = byCount.length === 5 && byCount[0][0] - byCount[4][0] === 4;
  const wheel = byCount.length === 5 && byCount[0][0] === 14 && byCount[1][0] === 5;
  const top = byCount[0];
  const [c1, c2] = [top[1], byCount[1]?.[1] ?? 0];
  const tile = (r: number) => ranks.filter((k) => k !== r);
  let cat: number;
  let t: number[];
  if (flush && (straight || wheel)) { cat = 8; t = [wheel ? 5 : byCount[0][0]]; }
  else if (c1 === 4) { cat = 7; t = [top[0], tile(top[0])[0]]; }
  else if (c1 === 3 && c2 === 2) { cat = 6; t = [top[0], byCount[1][0]]; }
  else if (flush) { cat = 5; t = ranks; }
  else if (straight || wheel) { cat = 4; t = [wheel ? 5 : byCount[0][0]]; }
  else if (c1 === 3) { cat = 3; t = [top[0], ...tile(top[0]).slice(0, 2)]; }
  else if (c1 === 2 && c2 === 2) { cat = 2; t = [top[0], byCount[1][0], ...ranks.filter((k) => k !== top[0] && k !== byCount[1][0]).slice(0, 1)]; }
  else if (c1 === 2) { cat = 1; t = [top[0], ...tile(top[0]).slice(0, 3)]; }
  else { cat = 0; t = ranks; }
  const pad = [0, 0, 0, 0, 0].map((_, i) => t[i] ?? 0);
  let score = cat;
  for (const v of pad) score = score * 16 + v;
  return score;
}

export function seatScore(state: HoldemState, seat: number): number {
  return bestOf5([...state.hole[seat]!, ...state.board]);
}

function raiseSize(state: HoldemState) {
  const bb = bigBlind(state.bet);
  return state.street < 2 ? bb : bb * 2;
}

// bot heuristic: returns 'fold' | 'check' | 'call' | 'raise'
function botDecision(state: HoldemState, seat: number): 'fold' | 'check' | 'call' | 'raise' {
  const cost = state.toCall - state.invested[seat];
  if (state.toCall === 0) {
    // free action: bet if strong, else check
    return state.street === 0 ? 'check' : (seatScore(state, seat) >= 15 ** 5 * 5 ? 'raise' : 'check');
  }
  if (state.street === 0) {
    const [a, b] = state.hole[seat]!;
    const ra = a % 13 === 0 ? 14 : a % 13;
    const rb = b % 13 === 0 ? 14 : b % 13;
    const pair = ra === rb;
    const high = Math.max(ra, rb) >= 10;
    const suited = Math.floor(a / 13) === Math.floor(b / 13);
    const str = pair ? 0.95 : high && suited ? 0.75 : high ? 0.6 : Math.abs(ra - rb) < 3 ? 0.45 : 0.25;
    if (str >= 0.8 && state.betCount < MAX_BETS) return 'raise';
    if (str < 0.35 && rng() < 0.7) return 'fold';
    if (rng() < 0.12 && state.betCount < MAX_BETS) return 'raise';
    return 'call';
  }
  const cat = Math.floor(seatScore(state, seat) / 15 ** 5);
  if (cat >= 5 && state.betCount < MAX_BETS) return 'raise';
  if (cat >= 3) return 'call';
  return rng() < 0.6 ? 'fold' : 'call';
}

function doSeatAction(state: HoldemState, seat: number, action: 'fold' | 'check' | 'call' | 'raise') {
  if (state.folded[seat]) return;
  if (action === 'fold') {
    state.folded[seat] = true;
    return;
  }
  if (action === 'raise' && state.betCount < MAX_BETS) {
    const pay = state.toCall + raiseSize(state) - state.invested[seat];
    if (state.stacks[seat] >= pay) {
      state.invested[seat] += pay;
      state.stacks[seat] -= pay;
      state.toCall += raiseSize(state);
      state.betCount++;
      state.freeActed = [false, false, false, false];
      return;
    }
  }
  // call or check
  const pay = state.toCall - state.invested[seat];
  if (pay > 0) {
    state.invested[seat] += pay;
    state.stacks[seat] -= pay;
  } else {
    state.freeActed[seat] = true;
  }
}

function remaining(state: HoldemState) {
  return SEATS.filter((s) => !state.folded[s]);
}

function owes(state: HoldemState, seat: number) {
  if (state.folded[seat]) return false;
  if (state.toCall > 0) return state.invested[seat] < state.toCall;
  return !state.freeActed[seat];
}

function nextStreet(state: HoldemState) {
  if (state.street === 3) {
    state.street = 4;
    state.over = true;
    return;
  }
  state.street = (state.street + 1) as HoldemState['street'];
  if (state.street === 1) state.board.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!);
  else if (state.street <= 3) state.board.push(state.deck.pop()!);
  state.toCall = 0;
  state.betCount = 0;
  state.freeActed = [false, false, false, false];
  if (remaining(state).length <= 1) state.over = true;
  else state.current = 0; // player is button: acts first postflop
}

function tick(state: HoldemState) {
  let guard = 0;
  while (!state.over && guard++ < 20) {
    const rem = remaining(state);
    if (rem.length === 1) {
      state.over = true;
      return;
    }
    if (state.toCall > 0 && rem.every((s) => state.invested[s] >= state.toCall)) {
      nextStreet(state);
      continue;
    }
    if (state.toCall === 0 && rem.every((s) => state.freeActed[s])) {
      nextStreet(state);
      continue;
    }
    const cur = state.current;
    let next = -1;
    for (let k = 1; k <= 4 && next < 0; k++) {
      const seat = (cur + k) % 4;
      if (owes(state, seat)) next = seat;
    }
    if (next < 0) {
      nextStreet(state);
      continue;
    }
    state.current = next;
    if (next === 0) return; // player's turn
    doSeatAction(state, next, botDecision(state, next));
  }
}

export interface ActResult {
  state: HoldemState;
  yourTurn: boolean;
  payout: number | null; // set when the hand is over
}

export function holdemAct(state: HoldemState, action: 'fold' | 'check' | 'call' | 'raise'): ActResult {
  if (state.over) throw Object.assign(new Error('hand is over'), { status: 400 });
  if (!owes(state, 0)) throw Object.assign(new Error('not your turn'), { status: 400 });
  doSeatAction(state, 0, action);
  tick(state);
  if (state.over) return { state, yourTurn: false, payout: settle(state) };
  return { state, yourTurn: state.current === 0, payout: null };
}

function settle(state: HoldemState): number {
  const rem = remaining(state);
  const pot = state.invested.reduce((a, b) => a + b, 0);
  let winner: number[];
  if (rem.length === 1) {
    winner = rem;
  } else {
    let best = -1;
    winner = [];
    for (const s of rem) {
      const sc = seatScore(state, s);
      if (sc > best) { best = sc; winner = [s]; }
      else if (sc === best) winner.push(s);
    }
  }
  winner.forEach((s) => (state.stacks[s] += Math.floor(pot / winner.length)));
  const net = state.stacks[0] - state.bet;
  const payout = Math.max(0, Math.round(net * 100) / 100);
  state.result = { winner, playerNet: net, payout };
  state.over = true;
  return payout;
}

export const STREET_LABEL = ['pre-flop', 'flop', 'turn', 'river', 'showdown'];

// run bots until it's the player's turn again (or the hand ends)
export function holdemRunToPlayer(state: HoldemState): { state: HoldemState; over: boolean; payout: number | null } {
  tick(state);
  if (state.over) return { state, over: true, payout: settle(state) };
  return { state, over: false, payout: null };
}

export function hview(s: HoldemState, revealed: boolean) {
  return {
    board: s.board.map(cardName),
    hole: s.hole[0]!.map(cardName),
    stacks: s.stacks,
    invested: s.invested,
    folded: s.folded,
    bots: SEATS.slice(1).map((i) => ({
      stacks: s.stacks[i],
      invested: s.invested[i],
      folded: s.folded[i],
      hole: revealed ? s.hole[i]!.map(cardName) : null,
    })),
    street: s.street,
    streetLabel: STREET_LABEL[s.street],
    pot: s.invested.reduce((a, b) => a + b, 0),
    toCall: s.toCall,
    callAmount: Math.max(0, s.toCall - s.invested[0]),
    current: s.current,
    canAct: s.current === 0 && !s.over,
    canRaise: s.betCount < MAX_BETS,
    over: s.over,
    result: s.result ?? null,
  };
}
