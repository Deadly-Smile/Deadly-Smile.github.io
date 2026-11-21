// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising aim assist and the gyro mapping. Run with:
//   node src/Pages/games/FPS/engine/aimAssist.test.js
import { aimAssist, assistTurn, ASSIST, ASSIST_RANGE } from "./aimAssist.js";
import { gyroLook } from "./touch.js";
import { look } from "./player.js";

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
const deg = (d) => (d * Math.PI) / 180;

// The player stands at the origin looking down -z (yaw 0), eye 1.6 m up; a
// 1.8 m target 15 m ahead, its chest at the eye's height or so.
const eye = [0, 1.6, 0];
const at = (x, z = -15) => ({ pos: [x, 0, z], height: 1.8 });
const assist = (targets, extra = {}) => aimAssist({ eye, yaw: 0, pitch: 0, targets, level: "standard", ...extra });

check("off: no help", aimAssist({ eye, yaw: 0, pitch: 0, targets: [at(0.2)], level: "off" }), null);
check("no one near the crosshair: no help", assist([at(8)]), null);
const near = assist([at(0.5)]);
check("a target just off the crosshair: look slows down", near.slow < 1 && near.slow >= ASSIST.standard.slow, true);
check("…and the pull points at it: right (a negative yaw) and a touch down to the chest", [near.dy < 0, near.dp < 0 && near.dp > -0.03], [true, true]);
const onIt = assist([at(0)]);
check("closer to the crosshair, slower still", onIt.slow < near.slow, true);
check("weaker further from the crosshair", assist([at(0.9)]).slow > near.slow, true);
check("hidden behind a wall: no help", assist([at(0.5)], { visible: () => false }), null);
check("out of range: no help", assist([at(0, -(ASSIST_RANGE + 5))]), null);
check("the nearest to the crosshair wins", r(assist([at(1), at(-0.3)]).dy, 3), r(assist([at(-0.3)]).dy, 3));
check("low is gentler than standard", aimAssist({ eye, yaw: 0, pitch: 0, targets: [at(0.5)], level: "low" }).pull < near.pull, true);

// The pull: a little per frame, never past the target.
const step = assistTurn(near, 1 / 60);
check("one frame turns a little toward the target", [step[0] < 0, Math.abs(step[0]) < Math.abs(near.dy)], [true, true]);
check("a long frame stops on the target, not past it", assistTurn(near, 10).map(v => r(v, 6)), [r(near.dy, 6), r(near.dp, 6)]);
check("no assist, no turn", assistTurn(null, 1 / 60), [0, 0]);
// Following the pull actually ends on the target.
const p = { yaw: 0, pitch: 0 };
for (let i = 0; i < 600; i++) {
  const a = aimAssist({ eye, yaw: p.yaw, pitch: p.pitch, targets: [at(0.5)], level: "standard" });
  if (!a) break;
  const [ty, tp] = assistTurn(a, 1 / 60);
  look(p, -ty, -tp);
}
check("held for a while, the crosshair settles on the chest", r(aimAssist({ eye, yaw: p.yaw, pitch: p.pitch, targets: [at(0.5)], level: "standard" }).off, 2), 0);

// Gyro: turning the phone, held either way round in landscape, turns the
// view the same way.
const left = gyroLook({ beta: 30, gamma: 0 }, 90, 0.5);   // top of the phone on the left
const right = gyroLook({ beta: -30, gamma: 0 }, 270, 0.5); // top on the right: the same physical turn
check("15° of turn → 15° of view", r(Math.abs(left[0])), r(deg(15)));
check("the same physical turn either way round gives the same look", [r(left[0]), r(left[1])], [r(right[0]), r(right[1])]);
check("tilting is pitch, turning is yaw", [gyroLook({ beta: 0, gamma: 20 }, 90, 1)[0], r(Math.abs(gyroLook({ beta: 0, gamma: 20 }, 90, 1)[1]))], [0, r(deg(20))]);
check("angles outside 0–359 are folded in", gyroLook({ beta: 10, gamma: 5 }, -90, 1), gyroLook({ beta: 10, gamma: 5 }, 270, 1));
check("no data → no turn", gyroLook(null, 90, 1), [-0, 0]);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll aim assist checks passed");
