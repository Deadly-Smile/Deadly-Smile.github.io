// ─── Which animation a character plays ──────────────────────────────────────
// Maps an actor's state to one of the character models' clips: Idle,
// Idle_Shoot, Walk, Run, Run_Shoot, the strafing runs (Run_Back, Run_Left,
// Run_Right), HitReact and Death. Models don't all have every clip, so each
// choice falls back to the nearest one the model has.
//
// Each locomotion clip plays at the rate that matches the ground speed (its
// feet stay planted instead of gliding), from the speed it was animated
// for, within limits so legs never spin unnaturally fast or slow.
// Crouching isn't a clip here: the renderer bends the legs over whatever
// clip is playing (so crouch-walking uses the walk).
// Pure: the renderer feeds it plain numbers and plays what it returns.

// m/s each clip was animated for, measured from the models' foot bones
// (foot sweep per cycle).
export const CLIP_SPEED = { Walk: 1.4, Run: 3.0, Run_Shoot: 2.9, Run_Back: 2.7, Run_Left: 3.0, Run_Right: 3.0, Run_Gun: 3.0 };
// Faster than this the legs switch from walking to running: aiming (2.8)
// and crouching (2.2) walk, normal movement (4.5) runs.
export const RUN_FROM = 3.0;
const MIN_RATE = 0.6;
const MAX_RATE = 1.8;
const MOVING = 0.6;                 // m/s; slower than this counts as standing
const FIRING_RECENT = 0.5;          // s after a shot the shooting poses are held
const HIT_REACT = 0.3;              // s a standing character flinches when hit
const STRAFE = { back: "Run_Back", left: "Run_Left", right: "Run_Right" };

// Which way an actor moves relative to where it faces: "forward", "back",
// "left" or "right" (the dominant one). yaw 0 faces -z.
export function moveDirection(vel, yaw) {
  const along = -vel[0] * Math.sin(yaw) - vel[2] * Math.cos(yaw);
  const side = vel[0] * Math.cos(yaw) - vel[2] * Math.sin(yaw);
  if (Math.abs(along) >= Math.abs(side)) return along >= 0 ? "forward" : "back";
  return side > 0 ? "right" : "left";
}

// Playback rate so a clip's feet keep pace with `speed`.
export const rateFor = (clip, speed) => clamp(speed / (CLIP_SPEED[clip] ?? CLIP_SPEED.Run), MIN_RATE, MAX_RATE);

// state: { dead, crouched, airborne, speed (m/s), dir (moveDirection),
//          firedAgo (s), hitAgo (s) }
// has:   Set of clip names the model provides
// → { clip, timeScale, once } — `once` clips stop on their last frame.
export function pickClip(state, has) {
  const first = (...names) => names.find(n => n && has.has(n)) ?? "Idle";
  const firing = state.firedAgo < FIRING_RECENT;
  const moving = (clip) => ({ clip, timeScale: rateFor(clip, state.speed), once: false });

  if (state.dead) return { clip: first("Death"), timeScale: 1, once: true };
  if (state.airborne) return { clip: first("Jump_Idle", "Idle"), timeScale: 1, once: false };

  if (state.speed >= MOVING) {
    const strafe = STRAFE[state.dir];
    if (strafe && has.has(strafe)) return moving(strafe);
    const walk = first(firing && "Walk_Shoot", "Walk");
    if (state.speed <= RUN_FROM && walk !== "Idle") return moving(walk);
    // Running: the natural arm swing, or the aiming run while shooting.
    return moving(firing ? first("Run_Shoot", "Run_Gun", "Run") : first("Run", "Run_Gun", "Run_Shoot"));
  }

  if (!state.crouched && state.hitAgo < HIT_REACT) return { clip: first("HitReact"), timeScale: 1, once: true };
  return { clip: firing ? first("Idle_Shoot") : "Idle", timeScale: 1, once: false };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
