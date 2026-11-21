// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the look maths. Run with:
//   node src/Pages/games/FPS/engine/aim.test.js
import { zoomLookScale, lookDelta, createRecoil, MOUSE_RADIANS_PER_PX } from "./aim.js";

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
const r = (v, d = 4) => +v.toFixed(d);
const rad = (deg) => (deg * Math.PI) / 180;

// Zoom: the same mouse movement moves the crosshair the same distance across
// the screen. A point at angle a off-centre sits at tan(a) / tan(fov / 2) of
// the half-screen; turning by `scale × a0` while zoomed must land a point
// where turning by a0 lands it unzoomed (for small turns).
check("no zoom, no change", [zoomLookScale(1, 75), zoomLookScale(1.2, 75)], [1, 1]);
for (const zoom of [0.85, 0.25]) {
  const fov = 75;
  const a0 = 0.001;
  const unzoomed = Math.tan(a0) / Math.tan(rad(fov) / 2);
  const zoomed = Math.tan(a0 * zoomLookScale(zoom, fov)) / Math.tan(rad(fov * zoom) / 2);
  check(`×${zoom} zoom: a flick moves the crosshair as far on screen`, r(zoomed / unzoomed, 3), 1);
}
check("the sniper scope turns a little slower than the zoom factor", zoomLookScale(0.25, 75) < 0.25, true);

const S = { sensitivity: 1, keyTurnSpeed: 2, invertY: false, adsSensitivity: 1 };
const still = { zoom: 1, fov: 75, ads: false };
check("mouse pixels → radians", lookDelta({ mouse: [100, -50], keys: [0, 0] }, S, still, 1 / 60).map(v => r(v)), [r(100 * MOUSE_RADIANS_PER_PX), r(-50 * MOUSE_RADIANS_PER_PX)]);
check("arrow keys turn by time", lookDelta({ mouse: [0, 0], keys: [1, -1] }, S, still, 0.05).map(v => r(v)), [0.1, -0.1]);
check("a long frame doesn't spin the view", r(lookDelta({ mouse: [0, 0], keys: [1, 0] }, S, still, 2)[0]), 0.2);
check("invert Y flips pitch only", lookDelta({ mouse: [10, 10], keys: [0, 0] }, { ...S, invertY: true }, still, 0).map(Math.sign), [1, -1]);
const aimed = { zoom: 0.75, fov: 75, ads: true };
const base = lookDelta({ mouse: [100, 0], keys: [0, 0] }, S, aimed, 0)[0];
check("aiming sensitivity scales only while aiming", [
  r(lookDelta({ mouse: [100, 0], keys: [0, 0] }, { ...S, adsSensitivity: 0.5 }, aimed, 0)[0] / base),
  r(lookDelta({ mouse: [100, 0], keys: [0, 0] }, { ...S, adsSensitivity: 0.5 }, still, 0)[0] / lookDelta({ mouse: [100, 0], keys: [0, 0] }, S, still, 0)[0]),
], [0.5, 1]);
check("settings without an aiming sensitivity work", r(lookDelta({ mouse: [100, 0], keys: [0, 0] }, { sensitivity: 1, keyTurnSpeed: 2 }, aimed, 0)[0]), r(base));

// Recoil eases in: the whole kick arrives, most of it within a few frames.
const recoil = createRecoil();
recoil.add(0.01, -0.05);
const first = recoil.take(1 / 60);
check("the first frame takes part of the kick, not all", first[1] < 0 && first[1] > -0.05, true);
let total = first[1];
for (let i = 0; i < 5; i++) total += recoil.take(1 / 60)[1];
check("about 95% within 100 ms", total < -0.05 * 0.94, true);
for (let i = 0; i < 60; i++) total += recoil.take(1 / 60)[1];
check("…and all of it in the end", r(total, 6), -0.05);
recoil.add(1, 1);
recoil.clear();
check("cleared on death", recoil.owed(), [0, 0]);
check("a zero-length frame takes nothing", (recoil.add(0, 1), recoil.take(0)), [0, 0]);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll aim checks passed");
