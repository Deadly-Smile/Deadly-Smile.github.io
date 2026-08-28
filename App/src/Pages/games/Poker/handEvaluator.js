// ─── Hand evaluation ─────────────────────────────────────────────────────────
// Card = { rank: 2..14 (14 = Ace), suit: 's'|'h'|'d'|'c' }.
// Category 8..0 (higher is better): straight flush, quads, full house, flush,
// straight, trips, two pair, one pair, high card.

export const CATEGORY_NAMES = [
  "High Card", "One Pair", "Two Pair", "Three of a Kind", "Straight",
  "Flush", "Full House", "Four of a Kind", "Straight Flush",
];

const RANK_LABELS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export function rankLabel(r) { return RANK_LABELS[r] || String(r); }

// All C(n,5) five-card subsets of `cards` (n is 5 or 7 for Hold'em; brute force
// is intentional here — showdown runs at most once per remaining player per
// hand, so a specialized 7-card evaluator would trade real error risk for
// performance that's never needed).
function fiveCardCombos(cards) {
  const n = cards.length;
  const result = [];
  const combo = [];
  (function backtrack(start) {
    if (combo.length === 5) { result.push(combo.slice()); return; }
    for (let i = start; i < n; i++) {
      combo.push(cards[i]);
      backtrack(i + 1);
      combo.pop();
    }
  })(0);
  return result;
}

// Evaluates exactly 5 cards.
export function evaluate5(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  const countByRank = new Map();
  for (const r of ranks) countByRank.set(r, (countByRank.get(r) || 0) + 1);
  // Groups of [rank, count], sorted by count desc then rank desc.
  const groups = [...countByRank.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const distinct = [...new Set(ranks)]; // still desc, Set preserves insertion order
  let straightHigh = null;
  for (let i = 0; i <= distinct.length - 5; i++) {
    if (distinct[i] - distinct[i + 4] === 4) { straightHigh = distinct[i]; break; }
  }
  // Wheel: A-2-3-4-5 counts as a 5-high straight, not ace-high.
  if (straightHigh === null && distinct.includes(14) && [5, 4, 3, 2].every(r => distinct.includes(r))) {
    straightHigh = 5;
  }

  if (isFlush && straightHigh !== null) {
    return { category: 8, tiebreakers: [straightHigh] };
  }
  if (groups[0][1] === 4) {
    const kicker = groups.find(g => g[1] === 1)[0];
    return { category: 7, tiebreakers: [groups[0][0], kicker] };
  }
  if (groups[0][1] === 3 && groups[1]?.[1] >= 2) {
    return { category: 6, tiebreakers: [groups[0][0], groups[1][0]] };
  }
  if (isFlush) {
    return { category: 5, tiebreakers: ranks };
  }
  if (straightHigh !== null) {
    return { category: 4, tiebreakers: [straightHigh] };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.filter(g => g[1] === 1).map(g => g[0]);
    return { category: 3, tiebreakers: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const pairs = groups.filter(g => g[1] === 2).map(g => g[0]);
    const kicker = groups.find(g => g[1] === 1)[0];
    return { category: 2, tiebreakers: [pairs[0], pairs[1], kicker] };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.filter(g => g[1] === 1).map(g => g[0]);
    return { category: 1, tiebreakers: [groups[0][0], ...kickers] };
  }
  return { category: 0, tiebreakers: ranks };
}

// Best 5-card hand out of 5, 6, or 7 cards.
export function evaluateBest(cards) {
  let best = null;
  for (const combo of fiveCardCombos(cards)) {
    const result = evaluate5(combo);
    if (!best || compareHandResults(result, best) > 0) best = result;
  }
  return best;
}

export function compareHandResults(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0, bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function describeHand(result) {
  const [t0, t1, t2] = result.tiebreakers;
  switch (result.category) {
    case 8: return `Straight Flush, ${rankLabel(t0)} high`;
    case 7: return `Four of a Kind, ${rankLabel(t0)}s`;
    case 6: return `Full House, ${rankLabel(t0)}s over ${rankLabel(t1)}s`;
    case 5: return `Flush, ${rankLabel(t0)} high`;
    case 4: return `Straight, ${rankLabel(t0)} high`;
    case 3: return `Three of a Kind, ${rankLabel(t0)}s`;
    case 2: return `Two Pair, ${rankLabel(t0)}s and ${rankLabel(t1)}s`;
    case 1: return `Pair of ${rankLabel(t0)}s`;
    default: return `High Card, ${rankLabel(t0)}`;
  }
}
