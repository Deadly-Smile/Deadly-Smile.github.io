// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the touch-control layout maths. Run with:
//   node src/Pages/games/FPS/engine/touchLayout.test.js
import {
  touchPrefs, resolveLayout, placeControl, resizeControl, resetLayout, inStickZone,
  DEFAULT_TOUCH, CONTROL_DEFAULTS, CONTROL_IDS, SCALE, SIZE_FACTOR,
} from "./touchLayout.js";

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
const r = (v) => Math.round(v);
const W = 844;
const H = 390;
const onScreen = (lay, w, h) => CONTROL_IDS.every(id => {
  const c = lay[id];
  const hw = id === "weapons" ? c.size * 4.6 : c.size / 2;
  return c.x - hw >= 0 && c.x + hw <= w && c.y - c.size / 2 >= 0 && c.y + c.size / 2 <= h;
});

// Stored preferences are filled in and kept in range.
check("nothing stored → the defaults", touchPrefs(undefined), DEFAULT_TOUCH);
check("junk is ignored", touchPrefs("nope"), DEFAULT_TOUCH);
const bad = touchPrefs({ scale: 9, opacity: -1, assist: "max", gyro: 3, lookSensitivity: NaN, layout: { fire: { cx: 2, cy: "x", k: 0.1 }, ghost: { cx: 0.5 }, aim: null } });
check("out-of-range values are clamped or reset", [bad.scale, bad.opacity, bad.assist, bad.gyro, bad.lookSensitivity], [SCALE[1], 0.2, "off", "off", 1]);
check("aim assist is off unless turned on", [DEFAULT_TOUCH.assist, touchPrefs({ assist: "low" }).assist], ["off", "low"]);
const old = touchPrefs({ aimAssist: "standard", scale: 1.2 });
check("an earlier build's always-on setting isn't carried over (the rest is)", [old.assist, "aimAssist" in old, old.scale], ["off", false, 1.2]);
check("…a moved control is kept in range; unknown controls dropped", bad.layout, { fire: { cx: 1, k: SIZE_FACTOR[0] } });

// The default layout on a typical phone (844 × 390, landscape).
const prefs = touchPrefs({});
const lay = resolveLayout(prefs, W, H);
check("Fire sits bottom right", [r(lay.fire.x), r(lay.fire.y), lay.fire.size], [780, 244, 84]);
check("the stick rests bottom left", [r(lay.stick.x), r(lay.stick.y), lay.stick.size], [96, 286, 112]);
check("every control is on screen", onScreen(lay, W, H), true);
check("…on a small phone too", onScreen(resolveLayout(touchPrefs({ scale: SCALE[1] }), 568, 320), 568, 320), true);
check("…and a tablet", onScreen(resolveLayout(prefs, 1180, 820), 1180, 820), true);

// Scale and size.
const big = resolveLayout(touchPrefs({ scale: 1.2 }), W, H);
check("scale grows every button", CONTROL_IDS.every(id => r(big[id].size) === r(CONTROL_DEFAULTS[id].size * 1.2)), true);
const resized = resolveLayout(resizeControl(prefs, "jump", 1.5), W, H);
check("resizing one control changes only it", [resized.jump.size, resized.fire.size], [90, 84]);
check("…within limits", resizeControl(prefs, "jump", 99).layout.jump.k, SIZE_FACTOR[1]);

// Mirrored (left-handed).
const left = resolveLayout(touchPrefs({ mirrored: true }), W, H);
check("left-handed: Fire on the left, stick on the right, same height", [r(left.fire.x), r(left.fire.y), r(left.stick.x)], [r(W - 780), 244, r(W - 96)]);
check("the joystick zone swaps sides", [inStickZone(prefs, 100, W), inStickZone(prefs, 700, W), inStickZone(touchPrefs({ mirrored: true }), 700, W)], [true, false, true]);

// Moving a control in the editor.
const moved = placeControl(prefs, "jump", 422, 195, W, H);
check("a moved control lands where it was dropped", [r(resolveLayout(moved, W, H).jump.x), r(resolveLayout(moved, W, H).jump.y)], [422, 195]);
check("…stored as fractions, so it fits another screen", [r(resolveLayout(moved, 1000, 500).jump.x), r(resolveLayout(moved, 1000, 500).jump.y)], [500, 250]);
const movedLeft = placeControl(touchPrefs({ mirrored: true }), "jump", 100, 195, W, H);
check("moved while left-handed: stored unmirrored, drawn where dropped", [r(movedLeft.layout.jump.cx * W), r(resolveLayout(movedLeft, W, H).jump.x)], [W - 100, 100]);
check("dropped half off the screen: pulled back on", resolveLayout(placeControl(prefs, "fire", W, H, W, H), W, H).fire.x <= W - 42, true);
check("unknown controls are ignored", placeControl(prefs, "ghost", 1, 1, W, H), prefs);
check("reset brings back the defaults", resolveLayout(resetLayout(moved), W, H), lay);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll touch layout checks passed");
