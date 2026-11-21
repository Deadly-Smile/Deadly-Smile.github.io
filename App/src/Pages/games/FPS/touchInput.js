// ─── Touch controls (phones and tablets) ────────────────────────────────────
// The touch counterpart of input.js, with the same interface, so the game
// (game.js / netGame.js) doesn't know which one it's reading. The on-screen
// controls (TouchControls.jsx) feed it: the joystick sets the stick, drags
// on the right half (and on the Fire button) add look, buttons press,
// release, toggle or queue actions.
//
// There's no pointer lock on a phone: lock() means "playing" (and asks for
// fullscreen and landscape where the browser allows it), unlock() means
// paused. Leaving fullscreen (the back gesture) pauses too.
import { stickKeys, gyroLook, TOUCH_LOOK_GAIN } from "./engine/touch.js";

// A thumb that moved within this long still counts as aiming (aim assist).
const ACTIVE_MS = 150;

// getPrefs(): the player's touch preferences (engine/touchLayout.js).
export function createTouchInput(root, { onLockChange, getPrefs = () => ({}) } = {}) {
  let locked = false;
  let typing = false;
  let full = false;          // we put the page in fullscreen
  let stick = { x: 0, y: 0 };
  const held = new Set();    // "fire", "scores"
  let ads = false;           // toggles
  let crouch = false;
  let queued = {};           // one-shot presses: jump, use, reload, last, slot
  let fireQueued = false;    // a tap shorter than a tick still fires
  let dx = 0;
  let dy = 0;
  let lookedAt = -Infinity;  // when a look drag last moved (ms)
  let gx = 0;                // gyro turn not yet taken (rad, [right, down])
  let gy = 0;
  let motionAt = null;       // time of the last devicemotion event (ms)

  const reset = () => {
    stick = { x: 0, y: 0 };
    held.clear();
    ads = crouch = fireQueued = false;
    queued = {};
    dx = dy = gx = gy = 0;
  };

  // Gyro aiming: the phone's rotation, while playing and if switched on
  // ("always", or "ads": only while aiming).
  const onMotion = (e) => {
    const now = performance.now();
    const dt = motionAt === null ? 0 : Math.min(0.1, (now - motionAt) / 1000);
    motionAt = now;
    const mode = getPrefs().gyro;
    if (!locked || typing || mode === "off" || !mode || (mode === "ads" && !ads)) return;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    const [x, y] = gyroLook(e.rotationRate, angle, dt);
    gx += x;
    gy += y;
  };
  window.addEventListener("devicemotion", onMotion);

  const fullscreenElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  const onFullscreenChange = () => {
    if (!fullscreenElement() && full) {
      full = false;
      if (locked) input.unlock();
    }
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  // Best effort: Android browsers allow both; iPhone Safari allows neither
  // (the game then fills the page instead, see FPS.jsx).
  function goFullscreen() {
    if (fullscreenElement()) return;
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
    if (!request) return;
    try {
      Promise.resolve(request.call(root, { navigationUI: "hide" }))
        .then(() => {
          full = true;
          return screen.orientation?.lock?.("landscape");
        })
        .catch(() => {});
    } catch {
      // Not allowed here (no user gesture): play in the page.
    }
  }

  const input = {
    controls: "touch",

    // ── Fed by the on-screen controls ──
    setStick(s) {
      if (locked && !typing) stick = s;
    },
    look(x, y) {
      if (!locked) return;
      dx += x;
      dy += y;
      if (x || y) lookedAt = performance.now();
    },
    press(name) {
      if (!locked || typing) return;
      if (name === "fire") fireQueued = true;
      held.add(name);
    },
    release(name) {
      held.delete(name);
    },
    // Aim and crouch toggle; returns the new state (for the button).
    toggle(name) {
      if (!locked || typing) return name === "ads" ? ads : crouch;
      if (name === "ads") ads = !ads;
      else if (name === "crouch") crouch = !crouch;
      return name === "ads" ? ads : crouch;
    },
    // jump, use, reload, last (weapon), or a weapon slot (0–3).
    tap(name, slot = null) {
      if (!locked || typing) return;
      if (name === "slot" || name === "last") ads = false;
      queued[name] = name === "slot" ? slot : true;
    },
    toggles: () => ({ ads, crouch }),
    // Died: aim and crouch don't carry over to the next life.
    clearToggles() {
      ads = crouch = false;
    },

    // ── Read by the game, like input.js ──
    read() {
      const state = { ...stickKeys(stick), crouch, jump: !!queued.jump, use: !!queued.use };
      queued.jump = queued.use = false;
      return state;
    },
    readWeapon() {
      const state = {
        fire: held.has("fire") || fireQueued, ads, reload: !!queued.reload,
        slot: queued.slot ?? null, scroll: 0, lastWeapon: !!queued.last,
      };
      fireQueued = false;
      queued.reload = queued.last = false;
      queued.slot = null;
      return state;
    },
    scoreboard: () => held.has("scores"),
    // Touch look has its own sensitivity, apart from the mouse's.
    lookSensitivity: () => getPrefs().lookSensitivity ?? 1,
    // Aim assist: the level the player chose, and whether a thumb is busy
    // aiming or moving (the pull only acts then).
    assistLevel: () => getPrefs().assist ?? "off",
    assistActive: () => locked && (held.has("fire") || stick.x !== 0 || stick.y !== 0 || performance.now() - lookedAt < ACTIVE_MS),
    // Gyro turn since last asked, in radians [right, down], with the
    // player's gyro sensitivity and invert applied.
    takeGyro() {
      const p = getPrefs();
      const k = (p.gyroSensitivity ?? 1) * (p.gyroInvert ? -1 : 1);
      const out = [gx * k, gy * k];
      gx = gy = 0;
      return out;
    },
    keyLook: () => [0, 0],
    takeLook() {
      const out = [dx * TOUCH_LOOK_GAIN, dy * TOUCH_LOOK_GAIN];
      dx = dy = 0;
      return out;
    },
    // Must be called from a tap (fullscreen needs a user gesture).
    lock() {
      goFullscreen();
      if (locked) return;
      locked = true;
      onLockChange?.(true);
    },
    unlock() {
      if (!locked) return;
      locked = false;
      reset();
      onLockChange?.(false);
    },
    isLocked: () => locked,
    setTyping(on) {
      typing = !!on;
      if (typing) {
        stick = { x: 0, y: 0 };
        held.clear();
      }
    },
    dispose() {
      window.removeEventListener("devicemotion", onMotion);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      if (fullscreenElement() && full) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
    },
  };
  return input;
}
