// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the touch-control maths. Run with:
//   node src/Pages/games/FPS/engine/touch.test.js
import { controlsFor, stickFrom, stickKeys, STICK_DEADZONE } from "./touch.js";

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

// Which controls a device gets.
check("a phone: touch", controlsFor({ maxTouchPoints: 5, coarsePointer: true, mobile: true }), "touch");
check("a phone with a stylus (fine pointer too) but a mobile browser: touch", controlsFor({ maxTouchPoints: 5, coarsePointer: false, mobile: true }), "touch");
check("a tablet (coarse main pointer): touch", controlsFor({ maxTouchPoints: 5, coarsePointer: true, mobile: false }), "touch");
check("a laptop with a touch screen: mouse and keyboard", controlsFor({ maxTouchPoints: 10, coarsePointer: false, mobile: false }), "mouse");
check("a desktop: mouse and keyboard", controlsFor({}), "mouse");
check("the player's choice wins either way", [controlsFor({ setting: "touch" }), controlsFor({ setting: "mouse", maxTouchPoints: 5, coarsePointer: true, mobile: true })], ["touch", "mouse"]);

// The stick.
check("a small drag is a partial push", stickFrom(28, 0, 56), { x: 0.5, y: 0, knob: [28, 0] });
const far = stickFrom(300, -400, 50);
check("a long drag is clamped to the rim", [Math.round(Math.hypot(far.x, far.y) * 1000) / 1000, far.knob.map(Math.round)], [1, [30, -40]]);

const keys = (x, y) => Object.entries(stickKeys({ x, y })).filter(([, v]) => v).map(([k]) => k).sort();
check("inside the dead zone: nothing", keys(STICK_DEADZONE * 0.9, 0), []);
check("up the screen is forward", keys(0, -0.6), ["forward"]);
check("down is back, sideways is strafing", [keys(0, 0.6), keys(-0.6, 0), keys(0.6, 0)], [["back"], ["left"], ["right"]]);
check("diagonals press two keys", [keys(0.5, -0.5), keys(-0.5, 0.5)], [["forward", "right"], ["back", "left"]]);
check("a little off straight is still straight", keys(0.15, -0.6), ["forward"]);
check("pushed to the rim forward: sprint", keys(0, -1), ["forward", "sprint"]);
check("…diagonally forward too", keys(0.7, -0.7), ["forward", "right", "sprint"]);
check("…but not backwards or sideways", [keys(0, 1), keys(1, 0)], [["back"], ["right"]]);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll touch checks passed");
