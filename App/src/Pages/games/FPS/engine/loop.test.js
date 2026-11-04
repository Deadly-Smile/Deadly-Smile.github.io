// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the fixed-timestep loop. Run manually with:
//   node src/Pages/games/FPS/engine/loop.test.js
import { advance, createLoop, STEP, MAX_STEPS_PER_FRAME } from "./loop.js";

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
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ─── advance() ───────────────────────────────────────────────────────────────
{
  const r = advance(0, STEP * 0.5);
  check("half a step runs nothing", r.steps, 0);
  check("half a step is kept", near(r.alpha, 0.5), true);
}
{
  const r = advance(STEP * 0.5, STEP * 0.75);
  check("leftover carries into the next frame", r.steps, 1);
  check("remainder after one step", near(r.accumulator, STEP * 0.25), true);
}
{
  const r = advance(0, STEP * 2);
  check("a slow frame runs several steps", r.steps, 2);
}
{
  const r = advance(0, 10);
  check("long stall is capped", r.steps, MAX_STEPS_PER_FRAME);
  check("backlog is dropped after a cap", r.accumulator, 0);
}
check("negative dt is ignored", advance(0, -1).steps, 0);

// ─── createLoop() with fake clock / rAF / document ──────────────────────────
function fakeEnv() {
  let t = 0;
  let queued = null;
  let nextId = 1;
  const listeners = {};
  const doc = {
    hidden: false,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type) => { delete listeners[type]; },
  };
  return {
    doc,
    now: () => t,
    raf: (cb) => { queued = cb; return nextId++; },
    caf: () => { queued = null; },
    tick(ms) { t += ms; const cb = queued; queued = null; cb?.(); },
    setHidden(h) { doc.hidden = h; listeners.visibilitychange?.(); },
    get queued() { return queued !== null; },
    get listening() { return !!listeners.visibilitychange; },
  };
}

{
  const env = fakeEnv();
  let updates = 0, renders = 0;
  const loop = createLoop({ update: () => updates++, render: () => renders++, ...env });
  loop.start();
  env.tick(17);
  env.tick(17);
  check("one update per 60 Hz frame", updates, 2);
  check("one render per frame", renders, 2);

  env.setHidden(true);
  check("hidden tab stops frames", env.queued, false);
  env.tick(60000); // a minute in the background — nothing queued, nothing runs
  check("no updates while hidden", updates, 2);

  env.setHidden(false);
  env.tick(17);
  check("clock resets on return (no catch-up burst)", updates, 3);

  loop.stop();
  check("stop cancels the frame", env.queued, false);
  check("stop removes the visibility listener", env.listening, false);
  check("stopped", loop.running, false);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll loop checks passed");
