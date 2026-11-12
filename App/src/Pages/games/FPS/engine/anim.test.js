// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the character animation blender. Run with:
//   node src/Pages/games/FPS/engine/anim.test.js
import { blend, localVelocity, CLIP_SPEED } from "./anim.js";
import { WALK_SPEED, SPRINT_SPEED, CROUCH_SPEED, ADS_SPEED } from "./player.js";

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
const r = (v, d = 3) => +v.toFixed(d);

// The clips the game's character models carry (see scripts/fps-models).
const MODEL = new Set(["Idle", "Idle_Shoot", "Walk", "Run", "Run_Back", "Run_Left", "Run_Right", "Run_Shoot", "HitReact", "Death"]);
const calm = { dead: false, crouched: false, airborne: false, vel: [0, 0, 0], yaw: 0, hitAgo: Infinity };
const b = (s, has = MODEL) => blend({ ...calm, ...s }, has);
const w = (s, has) => Object.fromEntries(Object.entries(b(s, has).weights).map(([k, v]) => [k, r(v)]));
const sum = (s) => r(Object.values(b(s).weights).reduce((a, x) => a + x, 0));
// Velocity for a speed and a direction relative to facing yaw 0 (-z ahead).
const go = (speed, ahead, right = 0) => {
  const n = Math.hypot(ahead, right);
  return [(right / n) * speed, 0, (-ahead / n) * speed];
};

// ─── Direction ───────────────────────────────────────────────────────────────
check("moving -z facing yaw 0 is forward", localVelocity([0, 0, -3], 0).map(v => r(v)), [3, 0]);
check("moving +x facing yaw 0 is to the right", localVelocity([3, 0, 0], 0).map(v => r(v)), [0, 3]);
check("facing yaw 90° (-x), moving -x is forward", localVelocity([-3, 0, 0], Math.PI / 2).map(v => r(v)), [3, 0]);

// ─── Standing, walking, running ──────────────────────────────────────────────
check("standing still → Idle", w({}), { Idle: 1 });
check("a slow drift is still standing", w({ vel: go(0.2, 1) }), { Idle: 1 });
check("starting to move fades Idle into the walk", [w({ vel: go(0.75, 1) }).Idle > 0, w({ vel: go(0.75, 1) }).Walk > 0], [true, true]);
check("aiming while moving (slow) → Walk", w({ vel: go(ADS_SPEED, 1) }), { Walk: 1 });
check("crouch-walking → Walk (legs are bent on top)", w({ crouched: true, vel: go(CROUCH_SPEED, 1) }), { Walk: 1 });
check("normal movement → Run", w({ vel: go(WALK_SPEED, 1) }), { Run: 1 });
check("sprinting → Run", w({ vel: go(SPRINT_SPEED, 1) }), { Run: 1 });

// ─── Direction blending ──────────────────────────────────────────────────────
check("strafing left → Run_Left", w({ vel: go(WALK_SPEED, 0, -1) }), { Run_Left: 1 });
check("strafing right → Run_Right", w({ vel: go(WALK_SPEED, 0, 1) }), { Run_Right: 1 });
check("backing away → Run_Back", w({ vel: go(WALK_SPEED, -1) }), { Run_Back: 1 });
check("forward-right diagonal → half Run, half Run_Right", w({ vel: go(WALK_SPEED, 1, 1) }), { Run: 0.5, Run_Right: 0.5 });
check("mostly forward, a little left → mostly Run", w({ vel: go(WALK_SPEED, 3, -1) }), { Run: 0.75, Run_Left: 0.25 });
check("turning the body changes the mix, not the velocity", w({ vel: [-WALK_SPEED, 0, 0], yaw: Math.PI / 2 }), { Run: 1 });
check("weights always sum to 1", [sum({}), sum({ vel: go(0.75, 1, 1) }), sum({ vel: go(WALK_SPEED, -2, 1) })], [1, 1, 1]);

// ─── One-shot clips ──────────────────────────────────────────────────────────
check("dead → Death, once", b({ dead: true, vel: go(3, 1) }), { weights: { Death: 1 }, rate: 1, once: "Death" });
check("hit while standing → HitReact, once", [w({ hitAgo: 0.1 }), b({ hitAgo: 0.1 }).once], [{ HitReact: 1 }, "HitReact"]);
check("hit while running keeps running", w({ hitAgo: 0.1, vel: go(WALK_SPEED, 1) }), { Run: 1 });
check("hit while crouched doesn't stand up to flinch", w({ hitAgo: 0.1, crouched: true }), { Idle: 1 });

// ─── Playback rate: feet keep pace with the ground ───────────────────────────
check("a clip at its own speed plays at 1×", r(b({ vel: go(CLIP_SPEED.Run + 0.001, 1) }).rate, 2), 1);
check("faster ground speed → faster legs", r(b({ vel: go(WALK_SPEED, 1) }).rate), r(WALK_SPEED / CLIP_SPEED.Run));
check("…capped so legs never spin", b({ vel: go(50, 1) }).rate, 1.8);
check("slow steps slow the legs", r(b({ vel: go(0.9, 1) }).rate), r(0.9 / CLIP_SPEED.Walk));
check("…but they never crawl", b({ vel: go(0.5, 1) }).rate, 0.6);
check("a diagonal uses the blended clips' speed", r(b({ vel: go(WALK_SPEED, -1, 1) }).rate), r(WALK_SPEED / ((CLIP_SPEED.Run_Back + CLIP_SPEED.Run_Right) / 2)));
check("in the air the stride freezes", [b({ airborne: true, vel: go(WALK_SPEED, 1) }).rate, w({ airborne: true, vel: go(WALK_SPEED, 1) })], [0, { Run: 1 }]);

// ─── Fallbacks for models missing clips ──────────────────────────────────────
const BASIC = new Set(["Idle", "Run", "Death"]);
check("no Walk clip → the run, slowed down", [w({ vel: go(CROUCH_SPEED, 1) }, BASIC), b({ vel: go(CROUCH_SPEED, 1) }, BASIC).rate < 1], [{ Run: 1 }, true]);
check("no strafe clips → the forward clip", w({ vel: go(WALK_SPEED, 0, -1) }, BASIC), { Run: 1 });
check("no HitReact → stays idle", w({ hitAgo: 0.1 }, BASIC), { Idle: 1 });
check("only Idle → Idle for everything", w({ vel: go(SPRINT_SPEED, 1) }, new Set(["Idle"])), { Idle: 1 });

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll animation checks passed");
