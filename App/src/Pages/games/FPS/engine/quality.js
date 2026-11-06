// ─── Graphics quality presets ───────────────────────────────────────────────
// What each "Graphics" setting trades away. Most of the game's cost is GPU
// fill rate (pixels × how expensive each pixel is), so the levers are:
//   renderScale  fraction of the display's resolution actually drawn
//   maxDpr       cap on the device pixel ratio (high-DPI laptop screens
//                otherwise draw up to 4× the pixels)
//   antialias    edge smoothing (fixed when the WebGL context is created,
//                so it changes the next time the game is opened)
//   lighting     "lambert" (cheap, looks the same on flat-coloured boxes) or
//                "standard" (physically based)
//   flashLights  muzzle/explosion lights that brighten nearby walls; every
//                pixel pays for them, lit or not
//   viewDistance metres drawn before the fog hides everything
//   models       animated character models, or the cheap box figures
// Pure: no three.js/DOM.

export const QUALITY = {
  low: { renderScale: 0.6, maxDpr: 1, antialias: false, lighting: "lambert", flashLights: false, viewDistance: 60, models: false },
  medium: { renderScale: 1, maxDpr: 1, antialias: true, lighting: "lambert", flashLights: true, viewDistance: 140, models: true },
  high: { renderScale: 1, maxDpr: 2, antialias: true, lighting: "standard", flashLights: true, viewDistance: 400, models: true },
};
export const QUALITY_LEVELS = ["low", "medium", "high"];
export const DEFAULT_QUALITY = "medium";

// Frame-rate limits offered (0 = as fast as the display refreshes).
export const FPS_LIMITS = [30, 60, 0];
export const DEFAULT_FPS_LIMIT = 60;
// The menu, pause and game-over screens never need more than this.
export const IDLE_FPS = 30;

export const qualityOf = (level) => QUALITY[level] ?? QUALITY[DEFAULT_QUALITY];

// Pixel ratio to render at, for a display's devicePixelRatio.
export function pixelRatio(level, dpr = 1) {
  const q = qualityOf(level);
  return Math.min(dpr || 1, q.maxDpr) * q.renderScale;
}

// Fog distances for a map, shortened to the quality's view distance.
export function fogRange(level, [near, far]) {
  const max = qualityOf(level).viewDistance;
  return far <= max ? [near, far] : [near * max / far, max];
}
