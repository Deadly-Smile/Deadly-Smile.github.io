// ─── Beginner odds helper ────────────────────────────────────────────────────
// Pure: no React, no DOM. Estimates how often the player's hand wins against
// N opponents with unknown cards by Monte Carlo — deal the opponents and the
// rest of the board at random from the unseen cards many times and count.
// Only uses what the player can legitimately see (own hole cards + board), so
// it works the same for solo, host and client seats.
import { evaluateBest, compareHandResults, describeHand, rankLabel, CATEGORY_NAMES } from "./handEvaluator.js";

export { CATEGORY_NAMES };

const SUITS = ["s", "h", "d", "c"];
// Budget of 7-card evaluations per estimate; split across opponents so a
// 6-handed table doesn't take 6x longer than heads-up.
const EVALUATION_BUDGET = 9000;
const MAX_ITERATIONS = 3000;

const cardKey = c => `${c.rank}${c.suit}`;

function unseenCards(known) {
  const seen = new Set(known.map(cardKey));
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      if (!seen.has(`${rank}${suit}`)) deck.push({ rank, suit });
    }
  }
  return deck;
}

export function defaultIterations(opponents) {
  return Math.min(MAX_ITERATIONS, Math.round(EVALUATION_BUDGET / (opponents + 1)));
}

// Returns { win, tie, lose, equity, categories, iterations }:
//   win/tie/lose — fraction of runouts where you win outright / split / lose
//   equity       — your expected share of the pot (a split counts 1/k)
//   categories   — chance of each final hand category (index = CATEGORY_NAMES)
// `rng` is injectable so tests can be deterministic.
export function estimateOdds({ hole, board = [], opponents, iterations, rng = Math.random }) {
  if (hole.length !== 2) throw new Error("estimateOdds needs exactly 2 hole cards");
  const n = iterations ?? defaultIterations(opponents);
  const deck = unseenCards([...hole, ...board]);
  const boardNeeded = 5 - board.length;
  const draw = boardNeeded + opponents * 2;

  let wins = 0, ties = 0, equity = 0;
  const categoryCounts = new Array(CATEGORY_NAMES.length).fill(0);

  for (let it = 0; it < n; it++) {
    // Partial Fisher-Yates: only the first `draw` cards need shuffling.
    for (let i = 0; i < draw; i++) {
      const j = i + Math.floor(rng() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const fullBoard = boardNeeded ? [...board, ...deck.slice(0, boardNeeded)] : board;
    const mine = evaluateBest([...hole, ...fullBoard]);
    categoryCounts[mine.category]++;

    let beaten = false, tiedWith = 0;
    for (let o = 0; o < opponents; o++) {
      const at = boardNeeded + o * 2;
      const theirs = evaluateBest([deck[at], deck[at + 1], ...fullBoard]);
      const cmp = compareHandResults(mine, theirs);
      if (cmp < 0) { beaten = true; break; }
      if (cmp === 0) tiedWith++;
    }
    if (beaten) continue;
    if (tiedWith > 0) { ties++; equity += 1 / (tiedWith + 1); }
    else { wins++; equity += 1; }
  }

  return {
    win: wins / n,
    tie: ties / n,
    lose: (n - wins - ties) / n,
    equity: equity / n,
    categories: categoryCounts.map(c => c / n),
    iterations: n,
  };
}

// What you hold right now (best 5 of hole + board), e.g. "Pair of 8s".
// Pre-flop there's no 5-card hand yet, so describe the starting hand.
export function currentHandLabel(hole, board = []) {
  if (hole.length !== 2) return "";
  if (board.length >= 3) return describeHand(evaluateBest([...hole, ...board]));
  const [a, b] = [...hole].sort((x, y) => y.rank - x.rank);
  if (a.rank === b.rank) return `Pocket ${rankLabel(a.rank)}s`;
  return `${rankLabel(a.rank)}-${rankLabel(b.rank)} ${a.suit === b.suit ? "suited" : "offsuit"}`;
}

// Share of the final pot you must win for a call to break even.
export function potOddsNeeded(toCall, pot) {
  if (toCall <= 0) return 0;
  return toCall / (pot + toCall);
}

// One-line, beginner-level read of the spot. Deliberately simple: compares
// equity against pot odds (calling) and against a fair share (betting).
export function adviceFor({ equity, toCall, pot, opponents }) {
  const fairShare = 1 / (opponents + 1);
  const needed = potOddsNeeded(toCall, pot);
  if (toCall > 0) {
    if (equity >= Math.max(needed, fairShare) * 1.5) return { verdict: "raise", text: "Strong hand here — raising is reasonable." };
    if (equity >= needed) return { verdict: "call", text: `Calling pays off: you need ${pct(needed)} and have about ${pct(equity)}.` };
    return { verdict: "fold", text: `Calling costs more than it's worth: you need ${pct(needed)} but have about ${pct(equity)}.` };
  }
  if (equity >= fairShare * 1.5) return { verdict: "raise", text: "You're ahead of your fair share — betting is reasonable." };
  return { verdict: "check", text: "Nothing to call — checking is free." };
}

export function pct(x) {
  if (x > 0 && x < 0.005) return "<1%";
  return `${Math.round(x * 100)}%`;
}
