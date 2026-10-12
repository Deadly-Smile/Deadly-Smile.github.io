// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the odds helper. Run manually with:
//   node src/Pages/games/Poker/odds.test.js
import { estimateOdds, currentHandLabel, potOddsNeeded, adviceFor, defaultIterations, pct } from "./odds.js";

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
const near = (x, target, tolerance) => Math.abs(x - target) <= tolerance;

// Deterministic RNG (mulberry32) so results are reproducible.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const c = s => ({ rank: { A: 14, K: 13, Q: 12, J: 11, T: 10 }[s[0]] ?? Number(s[0]), suit: s[1] });
const cards = str => str.split(" ").map(c);

// ── well-known equities ──
{
  const r = estimateOdds({ hole: cards("As Ah"), opponents: 1, iterations: 20000, rng: seeded(1) });
  check("AA vs 1 random hand ≈ 85%", near(r.equity, 0.85, 0.02), true);
  check("win + tie + lose = 1", near(r.win + r.tie + r.lose, 1, 1e-9), true);
  check("category chances sum to 1", near(r.categories.reduce((a, b) => a + b, 0), 1, 1e-9), true);
  check("AA always ends with at least a pair", r.categories[0], 0);
}
{
  const r = estimateOdds({ hole: cards("7c 2d"), opponents: 1, iterations: 20000, rng: seeded(2) });
  check("72o vs 1 random hand ≈ 35%", near(r.equity, 0.35, 0.025), true);
}
{
  const heads = estimateOdds({ hole: cards("As Ah"), opponents: 1, iterations: 5000, rng: seeded(3) });
  const five = estimateOdds({ hole: cards("As Ah"), opponents: 5, iterations: 5000, rng: seeded(3) });
  check("more opponents → lower equity", five.equity < heads.equity, true);
}

// ── made hands and splits ──
{
  const r = estimateOdds({ hole: cards("As Ks"), board: cards("Qs Js Ts 2d 3c"), opponents: 3, iterations: 500, rng: seeded(4) });
  check("royal flush on the river always wins", [r.win, r.categories[8]], [1, 1]);
}
{
  const r = estimateOdds({ hole: cards("2c 3d"), board: cards("As Ks Qs Js Ts"), opponents: 2, iterations: 500, rng: seeded(5) });
  check("royal flush on the board always splits", r.tie, 1);
  check("3-way split equity is 1/3", near(r.equity, 1 / 3, 1e-9), true);
}
{
  const r = estimateOdds({ hole: cards("Ah 9h"), board: cards("Kh 5h 2c"), opponents: 1, iterations: 20000, rng: seeded(6) });
  // 9 flush outs, two cards to come: 1 - (38/47 * 37/46) ≈ 35%.
  check("flush draw on the flop makes a flush ≈ 35%", near(r.categories[5], 0.35, 0.02), true);
}

// ── determinism / validation ──
{
  const a = estimateOdds({ hole: cards("Td 9d"), opponents: 2, iterations: 300, rng: seeded(7) });
  const b = estimateOdds({ hole: cards("Td 9d"), opponents: 2, iterations: 300, rng: seeded(7) });
  check("same seed → same result", a, b);
  let threw = false;
  try { estimateOdds({ hole: [], opponents: 1 }); } catch { threw = true; }
  check("needs two hole cards", threw, true);
  check("iteration budget shrinks with opponents", defaultIterations(5) < defaultIterations(1), true);
}

// ── labels and pot odds ──
check("pocket pair label", currentHandLabel(cards("Ad Ac")), "Pocket As");
check("suited label", currentHandLabel(cards("Ks As")), "A-K suited");
check("offsuit label", currentHandLabel(cards("7c Jd")), "J-7 offsuit");
check("post-flop label", currentHandLabel(cards("8c 8d"), cards("2s 9h Kd")), "Pair of 8s");
check("pot odds: call 50 into 150 needs 25%", potOddsNeeded(50, 150), 0.25);
check("nothing to call needs 0%", potOddsNeeded(0, 150), 0);
check("advice: fold when equity below pot odds", adviceFor({ equity: 0.1, toCall: 100, pot: 100, opponents: 1 }).verdict, "fold");
check("advice: call when equity covers pot odds", adviceFor({ equity: 0.4, toCall: 50, pot: 150, opponents: 1 }).verdict, "call");
check("advice: check when free and weak", adviceFor({ equity: 0.3, toCall: 0, pot: 40, opponents: 1 }).verdict, "check");
check("advice: raise when well ahead", adviceFor({ equity: 0.85, toCall: 0, pot: 40, opponents: 1 }).verdict, "raise");
check("pct formatting", [pct(0.4249), pct(0.001), pct(0)], ["42%", "<1%", "0%"]);

// ── speed: the UI runs this on the main thread ──
for (const opponents of [1, 5]) {
  const t0 = performance.now();
  estimateOdds({ hole: cards("Qh Jh"), opponents });
  console.log(`  (${opponents} opponent${opponents > 1 ? "s" : ""}, default iterations: ${Math.round(performance.now() - t0)}ms)`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
