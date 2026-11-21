// ─── Turning the view: mouse, arrow keys, zoom and recoil ───────────────────
// Shared by single-player (game.js) and multiplayer (netGame.js), applied
// once per frame before that frame's simulation ticks (see loop.js), so a
// shot goes where the crosshair is at that moment.
// Pure: no three.js/DOM.

// Radians of turn per pixel of mouse movement at sensitivity 1.
export const MOUSE_RADIANS_PER_PX = 0.0022;
// Recoil is paid out to the view at this rate (1/s): about 95% within 85 ms.
export const RECOIL_EASE = 35;

// How much slower to turn while zoomed. Matched to how much the image is
// magnified rather than to the zoom factor itself, so moving the mouse by the
// same amount moves the crosshair the same distance across the screen at any
// zoom. `zoom` multiplies the vertical field of view `fovDeg`.
export function zoomLookScale(zoom, fovDeg) {
  if (!(zoom < 1)) return 1;
  const half = (fovDeg * Math.PI) / 360;
  return Math.tan(half * zoom) / Math.tan(half);
}

// This frame's turn [yaw, pitch] (radians; right / down positive, as mouse
// movement) from the mouse pixels and the arrow keys held.
// view: { zoom, fov (degrees, unzoomed), ads }
export function lookDelta({ mouse, keys }, settings, { zoom, fov, ads }, frameDt) {
  const scale = zoomLookScale(zoom, fov) * (ads ? settings.adsSensitivity ?? 1 : 1);
  const k = MOUSE_RADIANS_PER_PX * settings.sensitivity * scale;
  const turn = settings.keyTurnSpeed * scale * Math.min(frameDt, 0.1);
  const sign = settings.invertY ? -1 : 1;
  return [mouse[0] * k + keys[0] * turn, (mouse[1] * k + keys[1] * turn) * sign];
}

// Recoil owed to the view: add each shot's kick, take a share per frame.
export function createRecoil() {
  const owed = [0, 0];
  return {
    add(yaw, pitch) {
      owed[0] += yaw;
      owed[1] += pitch;
    },
    // [yaw, pitch] to turn by this frame.
    take(frameDt) {
      const f = 1 - Math.exp(-RECOIL_EASE * Math.max(0, frameDt));
      const out = [owed[0] * f, owed[1] * f];
      owed[0] -= out[0];
      owed[1] -= out[1];
      return out;
    },
    clear() { owed[0] = owed[1] = 0; },
    owed: () => [...owed],
  };
}
