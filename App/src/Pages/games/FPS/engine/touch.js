// ─── Touch controls: the maths ──────────────────────────────────────────────
// Which controls a device gets, and how a thumb on the virtual joystick turns
// into the movement keys the game already understands (forward / back /
// left / right / sprint: the simulation and the network carry those as
// on/off keys, so the stick picks one of 8 directions rather than a speed).
// Pure: no DOM.

// Touch screens report CSS pixels; a thumb drag of a third of a phone's width
// should turn the view about 90°, so look drags count this many times a
// mouse pixel (see aim.js for what a mouse pixel turns).
export const TOUCH_LOOK_GAIN = 2.4;
export const STICK_DEADZONE = 0.25;  // of the stick's radius
export const SPRINT_AT = 0.9;        // pushed this far forward: sprint

// "touch" or "mouse". `setting` is the player's choice ("auto", "touch",
// "mouse"). Auto: touch on a phone or tablet, i.e. a touch screen whose main
// pointer is coarse or a mobile browser. Some phones also report a fine
// pointer (a stylus), so `any-pointer` alone isn't enough; a laptop with a
// touch screen has a fine main pointer and keeps mouse and keyboard.
export function controlsFor({ setting = "auto", maxTouchPoints = 0, coarsePointer = false, mobile = false } = {}) {
  if (setting === "touch" || setting === "mouse") return setting;
  return maxTouchPoints > 0 && (coarsePointer || mobile) ? "touch" : "mouse";
}

// A thumb `dx, dy` pixels from where it landed, on a stick of `radius`
// pixels: { x, y } inside the unit circle (y down, as on screen), and how far
// the knob is drawn ([kx, ky] pixels, clamped to the rim).
export function stickFrom(dx, dy, radius) {
  const d = Math.hypot(dx, dy);
  const k = d > radius ? radius / d : 1;
  return { x: (dx * k) / radius, y: (dy * k) / radius, knob: [dx * k, dy * k] };
}

const NO_KEYS = { forward: false, back: false, left: false, right: false, sprint: false };

// Stick position → movement keys: one of 8 directions (45° sectors), none
// inside the dead zone; sprint when pushed to the rim straight or
// diagonally forward.
export function stickKeys({ x, y }) {
  const mag = Math.hypot(x, y);
  if (mag < STICK_DEADZONE) return NO_KEYS;
  // 0 = forward (up the screen), clockwise, in eighths of a turn.
  const sector = ((Math.round(Math.atan2(x, -y) / (Math.PI / 4)) % 8) + 8) % 8;
  return {
    forward: sector === 7 || sector === 0 || sector === 1,
    right: sector >= 1 && sector <= 3,
    back: sector >= 3 && sector <= 5,
    left: sector >= 5 && sector <= 7,
    sprint: mag >= SPRINT_AT && (sector === 7 || sector === 0 || sector === 1),
  };
}

// ─── Gyro aiming ─────────────────────────────────────────────────────────────
// How the phone turned, from a `devicemotion` event's rotationRate (degrees
// per second about the device's own axes: x along the short edge, y along
// the long edge, z out of the screen), into this tick's look in the mouse's
// sense: [turn right, look down] in radians. Which device axis points up on
// screen depends on how the phone is held (`angle`: screen.orientation's
// angle, 0 / 90 / 180 / 270). At 1:1, turning the phone 10° turns the view 10°.
export function gyroLook(rate, angle, dt) {
  const k = (Math.PI / 180) * Math.max(0, dt);
  const beta = (rate?.beta ?? 0) * k;   // about x
  const gamma = (rate?.gamma ?? 0) * k; // about y
  switch (((Math.round(angle / 90) % 4) + 4) % 4) {
    case 1: return [-beta, gamma];  // landscape, the phone's top to the left
    case 3: return [beta, -gamma];  // landscape, the phone's top to the right
    case 2: return [gamma, beta];   // upside down
    default: return [-gamma, -beta];
  }
}
