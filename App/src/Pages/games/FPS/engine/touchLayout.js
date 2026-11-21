// ─── Touch controls: preferences and layout ─────────────────────────────────
// What a player can change about the phone controls, and where each control
// sits. A control's place is stored as its centre in fractions of the screen
// (so a layout made on one phone fits another) plus a size factor; the
// layout editor writes those, and resolveLayout() turns them into pixels for
// the screen at hand, mirrored for left-handed play and kept on screen.
// Pure: no DOM.

export const TOUCH_PREFS_VERSION = 1;

export const DEFAULT_TOUCH = {
  scale: 1,              // every button's size (SCALE)
  opacity: 0.85,         // of the controls (OPACITY)
  mirrored: false,       // left-handed: stick on the right, Fire on the left
  fixedStick: false,     // the stick stays at its spot instead of following the thumb
  lookSensitivity: 1,    // touch look, apart from the mouse's
  fireTurns: true,       // dragging the Fire button also turns the view
  leftFire: true,        // the small second Fire button
  assist: "off",         // aim assist: "off" | "low" | "standard"; only on if the player turns it on"
  gyro: "off",           // "off" | "ads" (while aiming) | "always"
  gyroSensitivity: 1,
  gyroInvert: false,
  layout: {},            // control id → { cx, cy, k }: moved / resized controls
};

export const SCALE = [0.7, 1.4];
export const OPACITY = [0.2, 1];
export const SIZE_FACTOR = [0.6, 1.6]; // one control's size, in the editor
const MARGIN = 6;                      // px kept between a control and the screen's edge

// Each control's default centre (fractions of width and height, laid out
// for the right hand) and size in px at scale 1. The stick's size is its
// diameter; the weapon bar's is its height.
export const CONTROL_DEFAULTS = {
  fire: { cx: 0.924, cy: 0.626, size: 84, label: "Fire" },
  aim: { cx: 0.82, cy: 0.497, size: 56, label: "Aim" },
  reload: { cx: 0.823, cy: 0.679, size: 50, label: "Reload" },
  jump: { cx: 0.924, cy: 0.862, size: 60, label: "Jump" },
  crouch: { cx: 0.836, cy: 0.867, size: 56, label: "Crouch" },
  fire2: { cx: 0.06, cy: 0.449, size: 54, label: "Left fire" },
  stick: { cx: 0.114, cy: 0.733, size: 112, label: "Joystick" },
  weapons: { cx: 0.5, cy: 0.94, size: 36, label: "Weapon bar" },
};
export const CONTROL_IDS = Object.keys(CONTROL_DEFAULTS);
const WEAPON_BAR_WIDTH = 9.2; // the bar is about this many times as wide as it is tall

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

// Stored preferences, filled in and kept in range (old or hand-edited
// storage can't break the controls). Only known keys are kept: an earlier
// build stored aim assist as `aimAssist`, on by default; it's now `assist`,
// off until chosen, so that old value is dropped rather than carried over.
export function touchPrefs(stored) {
  const src = stored && typeof stored === "object" ? stored : {};
  const p = { ...DEFAULT_TOUCH };
  for (const key of Object.keys(DEFAULT_TOUCH)) if (key in src) p[key] = src[key];
  p.scale = clamp(num(p.scale, 1), ...SCALE);
  p.opacity = clamp(num(p.opacity, DEFAULT_TOUCH.opacity), ...OPACITY);
  p.lookSensitivity = clamp(num(p.lookSensitivity, 1), 0.2, 4);
  p.gyroSensitivity = clamp(num(p.gyroSensitivity, 1), 0.2, 4);
  if (!["off", "low", "standard"].includes(p.assist)) p.assist = DEFAULT_TOUCH.assist;
  if (!["off", "ads", "always"].includes(p.gyro)) p.gyro = DEFAULT_TOUCH.gyro;
  const layout = {};
  for (const id of CONTROL_IDS) {
    const o = p.layout?.[id];
    if (!o || typeof o !== "object") continue;
    const e = {};
    if (Number.isFinite(o.cx)) e.cx = clamp(o.cx, 0, 1);
    if (Number.isFinite(o.cy)) e.cy = clamp(o.cy, 0, 1);
    if (Number.isFinite(o.k)) e.k = clamp(o.k, ...SIZE_FACTOR);
    if (Object.keys(e).length) layout[id] = e;
  }
  p.layout = layout;
  return p;
}

// Half the width and height a control takes up, for a size in px.
function halfExtent(id, size) {
  return id === "weapons" ? [(size * WEAPON_BAR_WIDTH) / 2, size / 2] : [size / 2, size / 2];
}

// Every control on a `w` × `h` screen: id → { x, y (centre, px), size (px) }.
export function resolveLayout(prefs, w, h) {
  const out = {};
  for (const id of CONTROL_IDS) {
    const d = CONTROL_DEFAULTS[id];
    const o = prefs.layout?.[id] ?? {};
    const size = d.size * (o.k ?? 1) * prefs.scale;
    let cx = o.cx ?? d.cx;
    if (prefs.mirrored) cx = 1 - cx;
    const [hw, hh] = halfExtent(id, size);
    out[id] = {
      x: w > 2 * (hw + MARGIN) ? clamp(cx * w, hw + MARGIN, w - hw - MARGIN) : w / 2,
      y: h > 2 * (hh + MARGIN) ? clamp((o.cy ?? d.cy) * h, hh + MARGIN, h - hh - MARGIN) : h / 2,
      size,
    };
  }
  return out;
}

// The editor dropped control `id` with its centre at (x, y) px on a w × h
// screen. Stored unmirrored, so switching hands keeps the layout.
export function placeControl(prefs, id, x, y, w, h) {
  if (!CONTROL_DEFAULTS[id]) return prefs;
  const cx = clamp(x / w, 0, 1);
  const entry = { ...prefs.layout[id], cx: prefs.mirrored ? 1 - cx : cx, cy: clamp(y / h, 0, 1) };
  return { ...prefs, layout: { ...prefs.layout, [id]: entry } };
}

// One control's size factor (1 = default).
export function resizeControl(prefs, id, k) {
  if (!CONTROL_DEFAULTS[id]) return prefs;
  return { ...prefs, layout: { ...prefs.layout, [id]: { ...prefs.layout[id], k: clamp(num(k, 1), ...SIZE_FACTOR) } } };
}

export const resetLayout = (prefs) => ({ ...prefs, layout: {} });

// Which side the joystick lives on: the left 45% (right 45% when mirrored).
export const STICK_ZONE = 0.45;
export const inStickZone = (prefs, x, w) => (prefs.mirrored ? x > w * (1 - STICK_ZONE) : x < w * STICK_ZONE);
