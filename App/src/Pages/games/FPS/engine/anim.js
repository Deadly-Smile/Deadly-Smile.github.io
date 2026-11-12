// ─── Which animations a character plays, and how much of each ───────────────
// The character models carry leg/body clips: Idle, Walk, Run, the strafing
// runs (Run_Back, Run_Left, Run_Right), HitReact and Death. Instead of
// picking one, blend() returns a weight per clip:
//   - standing ↔ moving fades with speed, so starts and stops are smooth;
//   - the direction of travel relative to facing blends forward / back /
//     left / right, so diagonals and turns don't snap between clips;
//   - the legs play at the rate that matches the ground speed (feet stay
//     planted instead of gliding), within limits.
// Arms aren't animated by clips at all: the renderer puts both hands on the
// weapon with IK, and bends the legs for crouching, over whatever plays.
// Models don't all have every clip; each falls back to the nearest one.
// Pure: the renderer feeds it plain numbers and applies what it returns.

// m/s each clip was animated for, measured from the models' foot bones
// (foot sweep per cycle).
export const CLIP_SPEED = { Walk: 1.4, Run: 3.0, Run_Shoot: 2.9, Run_Back: 2.7, Run_Left: 3.0, Run_Right: 3.0, Run_Gun: 3.0 };
// Faster than this, forward movement switches from the walk to the run:
// aiming (2.8) and crouching (2.2) walk, normal movement (4.5) runs.
export const RUN_FROM = 3.0;
const MIN_RATE = 0.6;
const MAX_RATE = 1.8;
// Speeds (m/s) over which standing fades into moving.
const MOVE_FROM = 0.3;
const MOVE_FULL = 1.2;
const HIT_REACT = 0.3;              // s a standing character flinches when hit

// Velocity relative to facing: [along (forward positive), side (right
// positive)]. yaw 0 faces -z.
export function localVelocity(vel, yaw) {
  return [
    -vel[0] * Math.sin(yaw) - vel[2] * Math.cos(yaw),
    vel[0] * Math.cos(yaw) - vel[2] * Math.sin(yaw),
  ];
}

// state: { dead, crouched, airborne, vel [x,y,z], yaw, hitAgo (s) }
// has:   Set of clip names the model provides
// → { weights: { clip: 0..1 } (sum 1), rate, once }
//   rate: playback rate of the moving clips (0 in the air: the stride
//         freezes mid-step); once: the clip to play through once, if any.
export function blend(state, has) {
  const first = (...names) => names.find(n => has.has(n)) ?? "Idle";
  if (state.dead) return { weights: { [first("Death")]: 1 }, rate: 1, once: first("Death") };

  const [along, side] = localVelocity(state.vel, state.yaw);
  const speed = Math.hypot(along, side);
  if (!state.crouched && !state.airborne && speed < MOVE_FROM && state.hitAgo < HIT_REACT && has.has("HitReact")) {
    return { weights: { HitReact: 1 }, rate: 1, once: "HitReact" };
  }

  const t = clamp((speed - MOVE_FROM) / (MOVE_FULL - MOVE_FROM), 0, 1);
  const move = t * t * (3 - 2 * t);
  const weights = {};
  const add = (clip, w) => { if (w > 1e-4) weights[clip] = (weights[clip] ?? 0) + w; };
  add("Idle", 1 - move);
  if (move > 0) {
    const forward = speed <= RUN_FROM && has.has("Walk") ? "Walk" : first("Run", "Run_Gun", "Run_Shoot");
    const total = Math.abs(along) + Math.abs(side) || 1;
    add(forward, (move * Math.max(0, along)) / total);
    add(has.has("Run_Back") ? "Run_Back" : forward, (move * Math.max(0, -along)) / total);
    add(has.has("Run_Right") ? "Run_Right" : forward, (move * Math.max(0, side)) / total);
    add(has.has("Run_Left") ? "Run_Left" : forward, (move * Math.max(0, -side)) / total);
  }

  // The speed the blended legs are animated for → rate that plants the feet.
  let animated = 0;
  let moving = 0;
  for (const [clip, w] of Object.entries(weights)) {
    if (clip === "Idle") continue;
    animated += w * (CLIP_SPEED[clip] ?? CLIP_SPEED.Run);
    moving += w;
  }
  const rate = state.airborne ? 0 : moving > 0 ? clamp(speed / (animated / moving), MIN_RATE, MAX_RATE) : 1;
  return { weights, rate, once: null };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
