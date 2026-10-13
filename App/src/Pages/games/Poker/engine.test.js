// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the engine. Run manually with:
//   node src/Pages/games/Poker/engine.test.js
import * as engine from "./engine.js";
import { diffEvents } from "./soundEvents.js";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`✗ ${name}`);
    console.error("  expected:", JSON.stringify(expected));
    console.error("  actual:  ", JSON.stringify(actual));
  } else {
    console.log(`✓ ${name}`);
  }
}

const totalChips = s => s.players.reduce((sum, p) => sum + p.stack, 0) + s.pot;
const actor = s => s.players[s.actingIndex];

// ─── Config ──────────────────────────────────────────────────────────────────
{
  const s = engine.createInitialState(3, { startingStack: 2000, smallBlind: 25, bigBlind: 50 }, { name: "Ann", avatar: "🦊" });
  check("config stacks", s.players.map(p => p.stack), [2000, 2000, 2000]);
  check("host identity", [s.players[0].name, s.players[0].avatar], ["Ann", "🦊"]);
  check("bots have distinct avatars", new Set(s.players.map(p => p.avatar)).size, 3);
  const h = engine.startHand(s);
  check("blinds from config", h.pot, 75);
  check("minRaise from config", h.minRaise, 50);

  const c = engine.applyConfig(s, { startingStack: 500, smallBlind: 5, bigBlind: 10 });
  check("applyConfig resets stacks", c.players.map(p => p.stack), [500, 500, 500]);
  check("applyConfig ignored mid-game", engine.applyConfig(h, { startingStack: 1 }).config.startingStack, 2000);
  check("old state without config", engine.getConfig({}).bigBlind, engine.DEFAULT_CONFIG.bigBlind);
}

// ─── Everyone all-in: the table must not be decided mid run-out ─────────────
{
  let s = engine.createInitialState(3, { startingStack: 1000, smallBlind: 10, bigBlind: 20 });
  s.players[0].stack = 1000; s.players[1].stack = 500; s.players[2].stack = 300;
  s = engine.startHand(s);
  const start = totalChips(s);

  // Preflop: first actor shoves, everyone else calls.
  const shover = actor(s);
  s = engine.applyAction(s, shover.id, "raise", shover.stack + shover.streetBet);
  let guard = 0;
  while (!engine.isBettingRoundOver(s) && guard++ < 10) s = engine.applyAction(s, actor(s).id, "call");
  check("preflop round over after calls", engine.isBettingRoundOver(s), true);

  let promptsAfterPreflop = 0, decidedEarly = false;
  guard = 0;
  while (s.street !== "handOver" && guard++ < 20) {
    if (engine.isBettingRoundOver(s) || s.actingIndex === -1) s = engine.advanceStreet(s);
    else { promptsAfterPreflop++; s = engine.applyAction(s, actor(s).id, "check"); }
    if (s.street !== "handOver" && engine.isTableDecided(s)) decidedEarly = true;
  }
  check("no lone-player prompts during run-out", promptsAfterPreflop, 0);
  check("not decided before showdown", decidedEarly, false);
  check("reached showdown", s.street, "handOver");
  check("board complete", s.board.length, 5);
  check("chips conserved", totalChips(s), start);
}

// ─── Lone player with chips facing an all-in must still call or fold ────────
{
  let s = engine.createInitialState(2);
  s.players[0].stack = 1000; s.players[1].stack = 100;
  s = engine.startHand(s);
  // Heads-up: dealer (seat 0) is SB and acts first.
  s = engine.applyAction(s, actor(s).id, "call");
  s = engine.applyAction(s, actor(s).id, "raise", 100); // short stack shoves
  check("big stack still owes a call", engine.isBettingRoundOver(s), false);
  check("raise not offered vs all-in", engine.legalActions(s, actor(s)), ["fold", "call"]);
  const before = s;
  s = engine.applyAction(s, actor(s).id, "raise", 500);
  check("illegal raise ignored", s === before || s.currentBet === before.currentBet, true);
  s = engine.applyAction(s, actor(s).id, "call");
  check("round over after call", engine.isBettingRoundOver(s), true);
}

// ─── Re-buys ────────────────────────────────────────────────────────────────
{
  let s = engine.createInitialState(2, { startingStack: 1000, rebuyEnabled: true, maxRebuys: 1 });
  s.street = "handOver"; s.handNumber = 3;
  s.players[0].stack = 0; s.players[0].inHand = true; s.players[1].stack = 2000;
  check("table decided", engine.isTableDecided(s), true);
  check("can rebuy", engine.canRebuy(s, s.players[0]), true);
  s = engine.rebuy(s, 0);
  check("rebuy adds starting stack", s.players[0].stack, 1000);
  check("table no longer decided", engine.isTableDecided(s), false);
  s.players[0].stack = 0;
  check("rebuy limit", engine.canRebuy(s, s.players[0]), false);

  const live = structuredClone(s);
  live.players[0].rebuys = 0; live.street = "flop"; live.players[0].allIn = true;
  check("no rebuy while all-in in a live hand", engine.canRebuy(live, live.players[0]), false);

  const bot = structuredClone(s);
  bot.players[1].stack = 0;
  check("bots never rebuy", engine.canRebuy(bot, bot.players[1]), false);

  const off = engine.createInitialState(2, { rebuyEnabled: false });
  off.players[0].stack = 0;
  check("rebuy disabled", engine.canRebuy(off, off.players[0]), false);
}

// ─── Sound events ───────────────────────────────────────────────────────────
{
  const s0 = engine.createInitialState(3);
  const s1 = engine.startHand(s0);
  check("new hand shuffles", diffEvents(s0, s1, 0).includes("shuffle"), true);
  const s2 = engine.applyAction(s1, actor(s1).id, "fold");
  check("fold sound", diffEvents(s1, s2, 0).includes("fold"), true);
  const s3 = engine.applyAction(s2, actor(s2).id, actor(s2).streetBet < s2.currentBet ? "call" : "check");
  const ev = diffEvents(s2, s3, 0);
  check("call/check makes a sound", ev.includes("chips") || ev.includes("check"), true);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
