// ─── Fixed-timestep accumulator ─────────────────────────────────────────────
// The simulation always advances in equal STEP-sized ticks, whatever the
// display's frame rate, so movement/physics behave the same at 30, 60 or
// 144 fps (and multiplayer can later run the same tick on every peer).
// Rendering then happens once per animation frame with `alpha` — how far we
// are between the last tick and the next — for interpolation.

export const STEP = 1 / 60;
// After a long stall (tab in background, debugger, slow frame) don't try to
// catch up on every missed tick — that would freeze the page for a while
// ("spiral of death"). Drop the backlog instead.
export const MAX_STEPS_PER_FRAME = 5;

// Pure: given the accumulated time and the elapsed frame time (seconds),
// returns how many ticks to run now and what's left over.
export function advance(accumulator, frameDt, step = STEP, maxSteps = MAX_STEPS_PER_FRAME) {
  let acc = accumulator + Math.max(0, frameDt);
  let steps = Math.floor(acc / step);
  if (steps > maxSteps) {
    steps = maxSteps;
    acc = 0;
  } else {
    acc -= steps * step;
  }
  return { steps, accumulator: acc, alpha: acc / step };
}

// Drives `update(step)` at a fixed rate and `render(alpha)` once per animation
// frame. Pauses itself while the tab is hidden and resets the clock on
// return, so coming back doesn't count the hidden time as one huge frame.
// `now`/`raf`/`caf`/`doc` are injectable for tests; the defaults are the browser's.
export function createLoop({
  update, render, step = STEP,
  now = () => performance.now(),
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
  doc = typeof document !== "undefined" ? document : null,
}) {
  let running = false;
  let rafId = null;
  let last = 0;
  let acc = 0;

  const frame = () => {
    const t = now();
    const r = advance(acc, (t - last) / 1000, step);
    last = t;
    acc = r.accumulator;
    for (let i = 0; i < r.steps; i++) update(step);
    render(r.alpha);
    rafId = raf(frame);
  };

  const startFrames = () => {
    if (rafId !== null) return;
    last = now();
    acc = 0;
    rafId = raf(frame);
  };
  const stopFrames = () => {
    if (rafId === null) return;
    caf(rafId);
    rafId = null;
  };

  const onVisibility = () => {
    if (!running) return;
    if (doc.hidden) stopFrames();
    else startFrames();
  };

  return {
    start() {
      if (running) return;
      running = true;
      doc?.addEventListener("visibilitychange", onVisibility);
      if (!doc?.hidden) startFrames();
    },
    stop() {
      running = false;
      doc?.removeEventListener("visibilitychange", onVisibility);
      stopFrames();
    },
    get running() { return running; },
  };
}
