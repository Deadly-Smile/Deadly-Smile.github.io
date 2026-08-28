// ─── Bot decision logic ──────────────────────────────────────────────────────
// Each bot has fixed `looseness`/`aggression` knobs (engine.createInitialState)
// so the table doesn't feel like five clones.
import { evaluateBest, compareHandResults } from "./handEvaluator";
import { legalActions, BIG_BLIND, SUITS } from "./engine";

const FULL_DECK = SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ rank: i + 2, suit })));
const cardKey = c => `${c.rank}${c.suit}`;

function remainingDeck(excluded) {
  const used = new Set(excluded.map(cardKey));
  return FULL_DECK.filter(c => !used.has(cardKey(c)));
}

// Partial Fisher–Yates: draws `n` cards without replacement from `pool`.
function drawN(pool, n) {
  const a = pool.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Monte Carlo equity: deals random hole cards to `numOpponents` and randomly
// completes the board, then measures the fraction of runouts this hand wins
// (a tie among the best hands counts as half a win). This is "equity vs a
// uniformly random hand" for each opponent — a well-known, cheap approximation
// real amateur poker bots use. It is NOT full-fledged range-based equity (it
// doesn't know an opponent who's been raising all day holds mostly big cards),
// but unlike a static made-hand heuristic it correctly reacts to draws, board
// texture, and how many opponents are still in the hand.
function estimateEquity(holeCards, board, numOpponents, samples) {
  if (numOpponents <= 0) return 1;
  const pool = remainingDeck([...holeCards, ...board]);
  const missingBoard = 5 - board.length;
  let wins = 0;

  for (let i = 0; i < samples; i++) {
    const drawn = drawN(pool, numOpponents * 2 + missingBoard);
    const fullBoard = board.concat(drawn.slice(numOpponents * 2));
    const myHand = evaluateBest(holeCards.concat(fullBoard));

    let beatenByAny = false, tiedTop = false;
    for (let o = 0; o < numOpponents; o++) {
      const oppHole = [drawn[o * 2], drawn[o * 2 + 1]];
      const cmp = compareHandResults(myHand, evaluateBest(oppHole.concat(fullBoard)));
      if (cmp < 0) { beatenByAny = true; break; }
      if (cmp === 0) tiedTop = true;
    }
    if (!beatenByAny) wins += tiedTop ? 0.5 : 1;
  }
  return wins / samples;
}

export function decideAction(state, player) {
  const legal = legalActions(state, player);
  const toCall = state.currentBet - player.streetBet;
  const { looseness, aggression } = player.personality;

  const numOpponents = state.players.filter(p => p.id !== player.id && p.inHand && !p.folded).length;
  const rawEquity = estimateEquity(player.holeCards, state.board, numOpponents, 150);
  // Looser bots play as if slightly ahead of their real equity, tighter bots
  // the opposite — the one place personality still overrides the math.
  const equity = Math.min(1, Math.max(0, rawEquity + (looseness - 0.5) * 0.12));
  const potOdds = toCall > 0 ? toCall / (state.pot + toCall) : 0;

  if (toCall > 0 && equity < potOdds) {
    return { type: "fold" };
  }

  const canBetOrRaise = legal.includes("bet") || legal.includes("raise");
  const wantsToRaise = canBetOrRaise && (
    equity > 0.5 + (1 - aggression) * 0.15 && Math.random() < 0.2 + aggression * 0.5
  );
  const bluffs = canBetOrRaise && Math.random() < 0.025 * aggression;

  if (wantsToRaise || bluffs) {
    const type = legal.includes("bet") ? "bet" : "raise";
    const potSize = Math.max(state.pot, BIG_BLIND);
    const sizeFrac = 0.4 + equity * 0.5 + Math.random() * 0.2; // bigger bets backed by more equity
    const minTarget = type === "bet" ? BIG_BLIND : state.currentBet + state.minRaise;
    const target = Math.max(minTarget, player.streetBet + Math.round(potSize * sizeFrac));
    const cappedTarget = Math.min(target, player.streetBet + player.stack);
    return { type, amount: cappedTarget };
  }

  return toCall > 0 ? { type: "call" } : { type: "check" };
}
