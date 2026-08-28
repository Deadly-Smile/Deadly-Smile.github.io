// ─── No-Limit Texas Hold'em engine ───────────────────────────────────────────
// Pure state-machine: no React, no DOM, no timers. `Poker.jsx` drives this by
// calling startHand()/applyAction()/advanceStreet() and re-rendering from the
// state it gets back.
import { evaluateBest, compareHandResults, describeHand } from "./handEvaluator";

export const SUITS = ["s", "h", "d", "c"];
export const STARTING_STACK = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

const BOT_NAMES = ["Ava", "Bo", "Cleo", "Dex", "Ellie"];

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createInitialState() {
  const randomPersonality = () => ({ looseness: 0.25 + Math.random() * 0.5, aggression: 0.25 + Math.random() * 0.5 });
  const players = [
    { id: 0, name: "You", isHuman: true, stack: STARTING_STACK, personality: randomPersonality() },
    // Fixed per-bot flavor so the table doesn't feel like five copies of one bot.
    ...BOT_NAMES.map((name, i) => ({ id: i + 1, name, isHuman: false, stack: STARTING_STACK, personality: randomPersonality() })),
  ];
  return {
    players: players.map(p => ({ ...p, folded: false, allIn: false, inHand: false, holeCards: [], streetBet: 0, totalContribution: 0, hasActed: false })),
    board: [], deck: [],
    street: "waiting", // waiting | preflop | flop | turn | river | showdown
    pot: 0, currentBet: 0, minRaise: BIG_BLIND,
    actingIndex: -1, dealerIndex: -1,
    handNumber: 0, log: [], result: null,
  };
}

function log(state, msg) { state.log = [...state.log, msg]; }

// Seat iteration for dealer/blind rotation — only cares whether a player still
// has chips to sit down with, not this hand's fold/all-in status.
function nextSeat(players, fromIndex) {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const i = (fromIndex + step) % n;
    if (players[i].stack > 0) return i;
  }
  return -1;
}

// Turn order during a live betting round — skips anyone out of the hand.
function nextToAct(players, fromIndex) {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const i = (fromIndex + step) % n;
    const p = players[i];
    if (p.inHand && !p.folded && !p.allIn) return i;
  }
  return -1;
}

function activePlayers(state) { return state.players.filter(p => p.inHand && !p.folded); }
function contestedPlayers(state) { return state.players.filter(p => p.inHand && !p.folded && !p.allIn); }

export function playersRemaining(state) { return state.players.filter(p => p.stack > 0).length; }

function postChips(player, amount) {
  const posted = Math.min(amount, player.stack);
  player.stack -= posted;
  player.streetBet += posted;
  player.totalContribution += posted;
  if (player.stack === 0) player.allIn = true;
  return posted;
}

export function startHand(prev) {
  const state = structuredClone(prev);
  state.handNumber += 1;
  state.board = [];
  state.pot = 0;
  state.result = null;
  state.log = [];

  for (const p of state.players) {
    p.inHand = p.stack > 0;
    p.folded = !p.inHand;
    p.allIn = false;
    p.holeCards = [];
    p.streetBet = 0;
    p.totalContribution = 0;
    p.hasActed = false;
  }

  const seated = state.players.filter(p => p.inHand);
  state.dealerIndex = state.dealerIndex === -1 ? 0 : nextSeat(state.players, state.dealerIndex);
  if (!state.players[state.dealerIndex].inHand) state.dealerIndex = nextSeat(state.players, state.dealerIndex);

  state.deck = shuffle(makeDeck());
  // Two rounds, one card at a time starting left of the dealer — matches a real deal.
  let dealFrom = state.dealerIndex;
  for (let round = 0; round < 2; round++) {
    let i = dealFrom;
    for (let n = 0; n < seated.length; n++) {
      i = nextSeat(state.players, i);
      state.players[i].holeCards.push(state.deck.pop());
    }
  }

  const heads_up = seated.length === 2;
  const sbIndex = heads_up ? state.dealerIndex : nextSeat(state.players, state.dealerIndex);
  const bbIndex = nextSeat(state.players, sbIndex);
  const sb = state.players[sbIndex], bb = state.players[bbIndex];
  const sbPosted = postChips(sb, SMALL_BLIND);
  const bbPosted = postChips(bb, BIG_BLIND);
  state.pot = sbPosted + bbPosted;
  state.currentBet = bb.streetBet; // handles a short-stacked all-in blind correctly
  state.minRaise = BIG_BLIND;
  log(state, `Hand #${state.handNumber} — ${sb.name} posts SB $${sbPosted}, ${bb.name} posts BB $${bbPosted}.`);

  state.actingIndex = heads_up ? sbIndex : nextSeat(state.players, bbIndex);
  state.street = "preflop";
  return finalizeIfHandOver(state);
}

function legalActions(state, player) {
  const toCall = state.currentBet - player.streetBet;
  const actions = ["fold"];
  if (toCall <= 0) actions.push("check"); else actions.push("call");
  if (player.stack > toCall) actions.push(state.currentBet === 0 ? "bet" : "raise");
  return actions;
}
export { legalActions };

// Applies one action for the player whose turn it currently is. `amount` is the
// TOTAL streetBet the player wants to reach (not the incremental chips) for
// bet/raise, matching how betting UIs usually present "raise to $X".
export function applyAction(prev, playerId, type, amount = 0) {
  const state = structuredClone(prev);
  const idx = state.players.findIndex(p => p.id === playerId);
  const player = state.players[idx];
  if (idx !== state.actingIndex) return state; // not this player's turn — ignore

  const toCall = state.currentBet - player.streetBet;

  if (type === "fold") {
    player.folded = true;
    log(state, `${player.name} folds.`);
  } else if (type === "check") {
    if (toCall > 0) return state; // illegal — there's a bet to face
    player.hasActed = true;
    log(state, `${player.name} checks.`);
  } else if (type === "call") {
    if (toCall <= 0) return state; // nothing to call — should've been a check
    const posted = postChips(player, toCall);
    state.pot += posted;
    player.hasActed = true;
    log(state, `${player.name} calls $${posted}${player.allIn ? " (all-in)" : ""}.`);
  } else if (type === "bet" || type === "raise") {
    if (type === "bet" && state.currentBet > 0) return state; // there's already a bet — must raise
    if (type === "raise" && state.currentBet === 0) return state; // nothing to raise — must bet
    const targetTotal = Math.max(amount, player.streetBet + 1);
    const increment = Math.min(targetTotal - player.streetBet, player.stack);
    const isAllIn = increment === player.stack;
    const raiseSize = player.streetBet + increment - state.currentBet;
    // Below the table minimum and not an all-in — reject rather than silently
    // clamp, so the UI can only ever produce legal actions.
    if (!isAllIn && type === "bet" && increment < BIG_BLIND) return state;
    if (!isAllIn && type === "raise" && raiseSize < state.minRaise) return state;

    const posted = postChips(player, increment);
    const newStreetBet = player.streetBet;
    state.pot += posted;
    // A short all-in raise below the minimum still reopens the action for
    // everyone else, but doesn't itself raise the minRaise bar — a deliberate
    // simplification vs. the formal casino "incomplete raise" rule, which
    // isn't worth the extra state for a casual single-table game.
    if (newStreetBet > state.currentBet) {
      if (raiseSize > 0) state.minRaise = Math.max(state.minRaise, raiseSize);
      state.currentBet = newStreetBet;
      for (const p of state.players) if (p.id !== player.id && p.inHand && !p.folded && !p.allIn) p.hasActed = false;
    }
    player.hasActed = true;
    log(state, `${player.name} ${type === "bet" ? "bets" : "raises to"} $${newStreetBet}${player.allIn ? " (all-in)" : ""}.`);
  } else {
    return state;
  }

  return advanceAfterAction(state);
}

function advanceAfterAction(state) {
  if (activePlayers(state).length <= 1) return finalizeIfHandOver(state);
  if (isBettingRoundOver(state)) return state; // Poker.jsx calls advanceStreet() next
  state.actingIndex = nextToAct(state.players, state.actingIndex);
  return state;
}

// Unlike applyAction, this folds a seat regardless of whose turn it currently
// is — used when a multiplayer guest's connection drops. All-in players are
// left alone: they can't act again anyway and are still entitled to see the
// hand through on whatever they already committed.
export function forceFoldPlayer(prev, playerId) {
  const state = structuredClone(prev);
  const idx = state.players.findIndex(p => p.id === playerId);
  const player = state.players[idx];
  if (!player || !player.inHand || player.folded || player.allIn) return state;

  player.folded = true;
  log(state, `${player.name} disconnected and folds.`);

  if (activePlayers(state).length <= 1) return finalizeIfHandOver(state);
  if (idx === state.actingIndex) state.actingIndex = nextToAct(state.players, idx);
  return state;
}

export function isBettingRoundOver(state) {
  const contested = contestedPlayers(state);
  if (contested.length === 0) return true; // everyone left is all-in
  return contested.every(p => p.hasActed && p.streetBet === state.currentBet);
}

// If a fold left exactly one player standing, they win the pot uncontested —
// no need to deal remaining streets or reach showdown.
function finalizeIfHandOver(state) {
  const remaining = activePlayers(state);
  if (remaining.length === 1) {
    const winner = remaining[0];
    winner.stack += state.pot;
    log(state, `${winner.name} wins $${state.pot} — everyone else folded.`);
    state.street = "handOver";
    state.result = { winners: [{ playerId: winner.id, amount: state.pot, hand: null }], unopposed: true };
    state.pot = 0;
  }
  return state;
}

export function advanceStreet(prev) {
  const state = structuredClone(prev);
  state.deck.pop(); // burn

  let dealt = [];
  if (state.street === "preflop") { dealt = popN(state.deck, 3); state.street = "flop"; }
  else if (state.street === "flop") { dealt = popN(state.deck, 1); state.street = "turn"; }
  else if (state.street === "turn") { dealt = popN(state.deck, 1); state.street = "river"; }
  else if (state.street === "river") { return settleShowdown(state); }
  else return state;
  state.board.push(...dealt);

  for (const p of state.players) {
    p.streetBet = 0;
    p.hasActed = false;
  }
  state.currentBet = 0;
  state.minRaise = BIG_BLIND;
  state.actingIndex = nextToAct(state.players, state.dealerIndex);
  log(state, `— ${state.street.toUpperCase()} — ${dealt.map(cardLabel).join(" ")}`);
  return finalizeIfHandOver(state);
}

function popN(deck, n) { const out = []; for (let i = 0; i < n; i++) out.push(deck.pop()); return out; }
function cardLabel(c) { return `${c.rank}${c.suit}`; }

// True once no further betting is possible this hand (everyone left who isn't
// folded is all-in) — Poker.jsx uses this to auto-run the board out instead of
// prompting for action that can't legally happen.
export function noMoreBettingPossible(state) {
  return contestedPlayers(state).length <= 1 && activePlayers(state).length > 1;
}

// Standard layered side-pot split: sort distinct total-contribution levels,
// each layer is shared by whoever contributed at least that much.
function computeSidePots(players) {
  const contributors = players.filter(p => p.totalContribution > 0);
  const levels = [...new Set(contributors.map(p => p.totalContribution))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    const layerPlayers = contributors.filter(p => p.totalContribution >= level);
    const amount = (level - prev) * layerPlayers.length;
    const eligible = layerPlayers.filter(p => !p.folded).map(p => p.id);
    if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  return pots;
}

function settleShowdown(state) {
  state.street = "showdown";
  const pots = computeSidePots(state.players);
  const hands = new Map();
  for (const p of activePlayers(state)) {
    const best = evaluateBest([...p.holeCards, ...state.board]);
    hands.set(p.id, best);
  }

  const winners = [];
  for (const potLayer of pots) {
    const contenders = potLayer.eligible.filter(id => hands.has(id));
    if (contenders.length === 0) continue;
    let bestHand = hands.get(contenders[0]);
    for (const id of contenders) if (compareHandResults(hands.get(id), bestHand) > 0) bestHand = hands.get(id);
    const layerWinners = contenders.filter(id => compareHandResults(hands.get(id), bestHand) === 0);
    const share = Math.floor(potLayer.amount / layerWinners.length);
    let remainder = potLayer.amount - share * layerWinners.length;
    // Odd chip goes to the first winner in seat order after the dealer button.
    const order = layerWinners.slice().sort((a, b) => seatOffset(state, a) - seatOffset(state, b));
    for (const id of order) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      const player = state.players.find(p => p.id === id);
      player.stack += share + extra;
      winners.push({ playerId: id, amount: share + extra, hand: hands.get(id) });
    }
  }

  for (const [id, hand] of hands) log(state, `${state.players.find(p => p.id === id).name} shows ${describeHand(hand)}.`);
  for (const w of winners) log(state, `${state.players.find(p => p.id === w.playerId).name} wins $${w.amount}.`);

  state.pot = 0;
  state.street = "handOver";
  state.result = { winners, unopposed: false, hands: Object.fromEntries(hands) };
  return state;
}

function seatOffset(state, playerId) {
  const idx = state.players.findIndex(p => p.id === playerId);
  return (idx - state.dealerIndex + state.players.length) % state.players.length;
}
