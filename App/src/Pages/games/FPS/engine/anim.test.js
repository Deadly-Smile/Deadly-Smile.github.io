// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the character animation chooser. Run with:
//   node src/Pages/games/FPS/engine/anim.test.js
import { pickClip, moveDirection, rateFor, CLIP_SPEED } from "./anim.js";
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

// The clips the game's character models carry (see scripts/fps-models).
const MODEL = new Set(["Idle", "Idle_Shoot", "Walk", "Run", "Run_Back", "Run_Left", "Run_Right", "Run_Shoot", "HitReact", "Death"]);
const calm = { dead: false, crouched: false, airborne: false, speed: 0, dir: "forward", firedAgo: Infinity, hitAgo: Infinity };
const clip = (s, has = MODEL) => pickClip({ ...calm, ...s }, has).clip;

// ─── Direction ───────────────────────────────────────────────────────────────
check("moving -z facing yaw 0 is forward", moveDirection([0, 0, -3], 0), "forward");
check("moving +z facing yaw 0 is back", moveDirection([0, 0, 3], 0), "back");
check("moving +x facing yaw 0 is right", moveDirection([3, 0, 0], 0), "right");
check("moving -x facing yaw 0 is left", moveDirection([-3, 0, 0], 0), "left");
check("facing yaw 90° (-x), moving -x is forward", moveDirection([-3, 0, 0], Math.PI / 2), "forward");
check("the dominant component wins", moveDirection([1, 0, -3], 0), "forward");

// ─── Clips ───────────────────────────────────────────────────────────────────
check("standing still → Idle", clip({}), "Idle");
check("just fired → Idle_Shoot", clip({ firedAgo: 0.1 }), "Idle_Shoot");
check("aiming while moving (slow) → Walk", clip({ speed: ADS_SPEED }), "Walk");
check("normal movement → Run (natural arm swing)", clip({ speed: WALK_SPEED }), "Run");
check("running while shooting → Run_Shoot", clip({ speed: WALK_SPEED, firedAgo: 0 }), "Run_Shoot");
check("sprinting → Run", clip({ speed: SPRINT_SPEED }), "Run");
check("strafing left → Run_Left", clip({ speed: WALK_SPEED, dir: "left" }), "Run_Left");
check("strafing right → Run_Right", clip({ speed: WALK_SPEED, dir: "right" }), "Run_Right");
check("backing away → Run_Back", clip({ speed: WALK_SPEED, dir: "back" }), "Run_Back");
check("crouched and still → Idle (the legs are bent on top)", clip({ crouched: true }), "Idle");
check("crouch-walking → Walk", clip({ crouched: true, speed: CROUCH_SPEED }), "Walk");
check("dead → Death, played once", pickClip({ ...calm, dead: true, speed: 3 }, MODEL), { clip: "Death", timeScale: 1, once: true });
check("hit while standing → HitReact", clip({ hitAgo: 0.1 }), "HitReact");
check("hit while running keeps running", clip({ hitAgo: 0.1, speed: SPRINT_SPEED }), "Run");
check("a slow drift counts as standing", clip({ speed: 0.3 }), "Idle");

// ─── Fallbacks for models missing clips ──────────────────────────────────────
const NO_WALK = new Set(["Idle", "Idle_Shoot", "Run", "Run_Shoot", "Death"]);
const slow = pickClip({ ...calm, speed: CROUCH_SPEED }, NO_WALK);
check("no Walk clip → the run, slowed down", [slow.clip, slow.timeScale < 1], ["Run", true]);
check("no strafe clips → forward clips", clip({ speed: WALK_SPEED, dir: "left" }, NO_WALK), "Run");
check("no plain Run → the aiming run", clip({ speed: SPRINT_SPEED }, new Set(["Idle", "Run_Shoot"])), "Run_Shoot");
check("only Idle → Idle for everything", [clip({ speed: SPRINT_SPEED }, new Set(["Idle"])), clip({ firedAgo: 0 }, new Set(["Idle"]))], ["Idle", "Idle"]);

// ─── Playback speed: feet keep pace with the ground ──────────────────────────
check("a clip at its own speed plays at 1×", rateFor("Run", CLIP_SPEED.Run), 1);
check("faster ground speed → faster legs", rateFor("Run", WALK_SPEED), WALK_SPEED / CLIP_SPEED.Run);
check("…capped so legs never spin", pickClip({ ...calm, speed: 50 }, MODEL).timeScale, 1.8);
check("…and never crawl", rateFor("Walk", 0.1), 0.6);
check("bots' top speed (walk) runs within the cap: feet planted", rateFor("Run", WALK_SPEED) < 1.8, true);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll animation checks passed");
