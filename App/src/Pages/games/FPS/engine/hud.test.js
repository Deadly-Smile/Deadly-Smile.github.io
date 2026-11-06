// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the HUD geometry helpers. Run with:
//   node src/Pages/games/FPS/engine/hud.test.js
import { crosshairGap, relativeAngle } from "./hud.js";

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

// Crosshair gap.
check("no spread → no gap", crosshairGap(0, 75, 900), 0);
check("half the FOV → half the screen height", r(crosshairGap((37.5 * Math.PI) / 180, 75, 900)), 450);
check("zooming in (smaller FOV) widens the same spread", crosshairGap(0.02, 20, 900) > crosshairGap(0.02, 75, 900), true);
check("taller viewport, proportionally wider", r(crosshairGap(0.03, 75, 1000) / crosshairGap(0.03, 75, 500)), 2);

// Damage direction (yaw 0 faces -z).
check("straight ahead", r(relativeAngle([0, 0, 0], 0, [0, 0, -5])), 0);
check("to the right", r(relativeAngle([0, 0, 0], 0, [5, 0, 0])), r(Math.PI / 2));
check("to the left", r(relativeAngle([0, 0, 0], 0, [-5, 0, 0])), r(-Math.PI / 2));
check("behind", r(Math.abs(relativeAngle([0, 0, 0], 0, [0, 0, 5]))), r(Math.PI));
check("turning to face it brings it ahead", r(relativeAngle([0, 0, 0], -Math.PI / 2, [5, 0, 0])), 0);
check("height doesn't matter", r(relativeAngle([0, 0, 0], 0, [5, 9, 0])), r(Math.PI / 2));

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll HUD checks passed");
