// ─── Which animation a character plays ──────────────────────────────────────
// Maps an actor's state to one of the character models' clips: Idle,
// Idle_Shoot, Walk, Run, Run_Shoot, the strafing runs (Run_Back, Run_Left,
// Run_Right), HitReact and Death. Models don't all have every clip, so each
// choice falls back to the nearest one the model has, slowed to match.
// Crouching isn't a clip here: the renderer bends the legs over whatever
// clip is playing (so crouch-walking uses the walk).
// Pure: the renderer feeds it plain numbers and plays what it returns.

export const RUN_SPEED = 6.8;       // m/s the Run clips are animated for (the sprint)
export const WALK_SPEED_ANIM = 3.2; // m/s the Walk clip is animated for
// Faster than this is a run: between the game's walk (4.5) and sprint (6.8).
export const RUN_FROM = 5.6;
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

// state: { dead, crouched, airborne, speed (m/s), dir (moveDirection),
//          firedAgo (s), hitAgo (s) }
// has:   Set of clip names the model provides
// → { clip, timeScale, once } — `once` clips stop on their last frame.
export function pickClip(state, has) {
  const first = (...names) => names.find(n => n && has.has(n)) ?? "Idle";
  const firing = state.firedAgo < FIRING_RECENT;

  if (state.dead) return { clip: first("Death"), timeScale: 1, once: true };
  if (state.airborne) return { clip: first("Jump_Idle", "Idle"), timeScale: 1, once: false };

  if (state.speed >= MOVING) {
    const strafe = STRAFE[state.dir];
    if (strafe && has.has(strafe)) {
      return { clip: strafe, timeScale: clamp(state.speed / RUN_SPEED, 0.5, 1.4), once: false };
    }
    if (!state.crouched && state.speed > RUN_FROM) {
      // Running with a gun: the clip that holds it forward, not the unarmed run.
      return { clip: first("Run_Shoot", "Run_Gun", "Run"), timeScale: clamp(state.speed / RUN_SPEED, 0.6, 1.4), once: false };
    }
    const walk = first(firing && "Walk_Shoot", "Walk");
    if (walk !== "Idle") return { clip: walk, timeScale: clamp(state.speed / WALK_SPEED_ANIM, 0.5, 1.6), once: false };
    // No walk clip: the run, slowed to walking pace.
    return { clip: first("Run_Shoot", "Run_Gun", "Run"), timeScale: clamp(state.speed / RUN_SPEED, 0.45, 1), once: false };
  }

  if (!state.crouched && state.hitAgo < HIT_REACT) return { clip: first("HitReact"), timeScale: 1, once: true };
  return { clip: firing ? first("Idle_Shoot") : "Idle", timeScale: 1, once: false };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
