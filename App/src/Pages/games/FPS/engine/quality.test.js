// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the graphics quality presets. Run with:
//   node src/Pages/games/FPS/engine/quality.test.js
import { QUALITY, QUALITY_LEVELS, pixelRatio, fogRange, qualityOf, DEFAULT_QUALITY, FPS_LIMITS, DEFAULT_FPS_LIMIT } from "./quality.js";

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

check("three levels, all defined", QUALITY_LEVELS.every(l => QUALITY[l]), true);
check("unknown level falls back to the default", qualityOf("ultra"), QUALITY[DEFAULT_QUALITY]);
check("each level costs at least as much as the one below", QUALITY_LEVELS.every((l, i) => i === 0
  || (QUALITY[l].viewDistance >= QUALITY[QUALITY_LEVELS[i - 1]].viewDistance
    && pixelRatio(l, 2) >= pixelRatio(QUALITY_LEVELS[i - 1], 2))), true);

// Pixel ratio: high-DPI screens are capped below High.
check("low on a 2× screen draws 0.6× pixels per CSS pixel", pixelRatio("low", 2), 0.6);
check("medium caps a 2× screen at 1×", pixelRatio("medium", 2), 1);
check("high keeps a 2× screen at 2×", pixelRatio("high", 2), 2);
check("high caps a 3× screen at 2×", pixelRatio("high", 3), 2);
check("a missing devicePixelRatio counts as 1", pixelRatio("high", undefined), 1);

// Fog: shortened to the view distance, keeping its shape.
check("fog within the view distance is left alone", fogRange("high", [35, 110]), [35, 110]);
check("fog beyond it is pulled in proportionally", fogRange("low", [30, 120]), [15, 60]);

check("frame limits include 'unlimited' (0)", FPS_LIMITS.includes(0) && FPS_LIMITS.includes(DEFAULT_FPS_LIMIT), true);
check("low drops the models and flash lights", [QUALITY.low.models, QUALITY.low.flashLights], [false, false]);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll quality checks passed");
