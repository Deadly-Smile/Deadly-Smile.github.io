// ─── Aim assist (touch controls only) ───────────────────────────────────────
// Aiming with a thumb is far coarser than with a mouse, so mobile shooters
// help a little. When a visible enemy is close to the crosshair:
//   slowdown  the player's own look moves slower, so a swipe across a target
//             doesn't fly past it
//   pull      the view turns gently toward the target's chest, but only while
//             the player is moving a thumb (look, stick or fire): it never
//             aims on its own
// Both fade out toward the edge of a small window around the target, which
// is wider for nearer (bigger-looking) targets. It only turns the view; in
// multiplayer the host still judges every shot.
// Pure: no three.js/DOM.
import { yawTo, pitchTo } from "./ai.js";

export const ASSIST = {
  low: { slow: 0.75, pull: 0.45 },      // look speed on target (×), pull (rad/s) on target
  standard: { slow: 0.55, pull: 0.9 },
};
export const ASSIST_RANGE = 70;          // m
const WINDOW = [0.035, 0.16];            // rad, the window's narrowest and widest
const CHEST = 0.72;                      // aim point, as a fraction of the target's height

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The target to help with, or null. targets: [{ pos (feet), height }];
// visible(point) says whether the eye can see a point.
// → { slow (× look), pull (rad/s), dy, dp (yaw / pitch to the target), off (rad) }
export function aimAssist({ eye, yaw, pitch, targets, level, visible = () => true }) {
  const preset = ASSIST[level];
  if (!preset) return null;
  let best = null;
  for (const t of targets) {
    const aim = [t.pos[0], t.pos[1] + t.height * CHEST, t.pos[2]];
    const dist = Math.hypot(aim[0] - eye[0], aim[1] - eye[1], aim[2] - eye[2]);
    if (dist < 0.5 || dist > ASSIST_RANGE) continue;
    const dy = wrap(yawTo(eye, aim) - yaw);
    const dp = pitchTo(eye, aim) - pitch;
    // Yaw counts for less looking up or down (the sky's lines of longitude meet).
    const off = Math.hypot(dy * Math.cos(pitch), dp);
    const window = clamp(Math.atan(0.9 / dist) * 2.2, ...WINDOW);
    const k = off / window;
    if (k >= 1 || (best && k >= best.k) || !visible(aim)) continue;
    best = { k, dy, dp, off };
  }
  if (!best) return null;
  const w = 1 - best.k; // 1 on the target, 0 at the window's edge
  return { slow: 1 - (1 - preset.slow) * w, pull: preset.pull * w, dy: best.dy, dp: best.dp, off: best.off };
}

// This frame's pull: [yaw, pitch] to add to the view, at most `pull × dt`
// along the way to the target and never past it.
export function assistTurn(a, dt) {
  if (!a || a.off <= 1e-6) return [0, 0];
  const k = Math.min(1, (a.pull * Math.max(0, dt)) / a.off);
  return [a.dy * k, a.dp * k];
}
