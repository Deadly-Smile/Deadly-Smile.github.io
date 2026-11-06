// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising sound positioning. Run with:
//   node src/Pages/games/FPS/engine/sound.test.js
import { spatial, REF_DISTANCE, MAX_DISTANCE } from "./sound.js";

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
const at = (x, z) => spatial([0, 0, 0], 0, [x, 0, z]); // listener faces -z

check("close by: full volume", at(0, -2).gain, 1);
check("twice the reference distance: half volume", at(0, -REF_DISTANCE * 2).gain, 0.5);
check("too far: silent", at(0, -(MAX_DISTANCE + 1)).gain, 0);
check("to the right: panned right", at(10, 0).pan > 0.8, true);
check("to the left: panned left", at(-10, 0).pan < -0.8, true);
check("straight ahead: centred", Math.abs(at(0, -10).pan) < 1e-9, true);
check("right next to you isn't hard-panned", Math.abs(at(1, 0).pan) < 0.3, true);
check("behind is duller than ahead", at(0, 10).cutoff < at(0, -10).cutoff * 0.6, true);
check("far is duller than near", at(0, -60).cutoff < at(0, -5).cutoff, true);
check("turning toward a sound centres it", Math.abs(spatial([0, 0, 0], -Math.PI / 2, [10, 0, 0]).pan) < 1e-9, true);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll sound checks passed");
