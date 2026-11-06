// ─── HUD geometry ───────────────────────────────────────────────────────────
// Small pure helpers behind the HUD: where on screen the crosshair's arms go
// for the current spread, and which way a damage indicator points. No DOM.

// Pixels from the screen centre to where a ray `spread` radians off the
// view axis lands, for a vertical field of view `fovDeg` and a viewport
// `height` px tall — so the crosshair's gap shows the real cone of fire.
export function crosshairGap(spread, fovDeg, height) {
  const half = (fovDeg * Math.PI) / 360;
  return (Math.tan(spread) / Math.tan(half)) * (height / 2);
}

// Angle (radians) of a point as seen by someone at `pos` facing `yaw`
// (0 = -z): 0 straight ahead, positive to the right, ±π behind.
export function relativeAngle(pos, yaw, point) {
  const dx = point[0] - pos[0];
  const dz = point[2] - pos[2];
  const ahead = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return Math.atan2(right, ahead);
}
