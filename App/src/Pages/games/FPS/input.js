// ─── Keyboard + mouse (pointer lock) ────────────────────────────────────────
// Keys are read by `code`, i.e. physical position, so WASD stays WASD on
// AZERTY and other layouts. The arrow keys look around (for touchpads, which
// most laptops silence while a key is held, and keyboard-only play). Nothing
// is read unless the pointer is locked to the game, so typing elsewhere on
// the page never moves the player.
const BINDINGS = {
  forward: ["KeyW"],
  back: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  sprint: ["ShiftLeft", "ShiftRight"],
  crouch: ["KeyC"],
};
// Keys whose browser default (scrolling, find-as-you-type…) must not fire mid-game.
const PREVENT = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Slash", "Quote"]);
// Some browsers report one huge spurious movement right after locking.
const MAX_MOUSE_JUMP = 400;

export function createInput(lockTarget, { onLockChange, onLockError } = {}) {
  const down = new Set();
  let jumpQueued = false; // a key press, not a held key: one jump per press
  let dx = 0;
  let dy = 0;
  // Weapon controls: mouse buttons are held; the rest are presses queued
  // until the next tick reads them.
  let fireHeld = false;
  // A click can start and end between two ticks (touchpad taps often do);
  // remember the press so the next tick still sees the trigger pulled.
  let fireQueued = false;
  let adsHeld = false;
  let slotQueued = null;
  let reloadQueued = false;
  let lastQueued = false;
  let scroll = 0;

  const isLocked = () => document.pointerLockElement === lockTarget;
  const reset = () => {
    down.clear();
    jumpQueued = false;
    dx = dy = 0;
    fireHeld = fireQueued = adsHeld = reloadQueued = lastQueued = false;
    slotQueued = null;
    scroll = 0;
  };

  const onKeyDown = (e) => {
    if (!isLocked()) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === "Space") jumpQueued = true;
      else if (e.code === "KeyR") reloadQueued = true;
      else if (e.code === "KeyQ") lastQueued = true;
      else if (/^Digit[1-4]$/.test(e.code)) slotQueued = Number(e.code[5]) - 1;
    }
    down.add(e.code);
  };
  const onMouseDown = (e) => {
    if (!isLocked()) return;
    if (e.button === 0) fireHeld = fireQueued = true;
    else if (e.button === 2) adsHeld = true;
  };
  const onMouseUp = (e) => {
    if (e.button === 0) fireHeld = false;
    else if (e.button === 2) adsHeld = false;
  };
  const onWheel = (e) => {
    if (!isLocked()) return;
    e.preventDefault();
    if (e.deltaY) scroll = Math.sign(e.deltaY);
  };
  const onContextMenu = (e) => {
    if (isLocked()) e.preventDefault();
  };
  const onKeyUp = (e) => down.delete(e.code);
  const onMouseMove = (e) => {
    if (!isLocked()) return;
    if (Math.abs(e.movementX) > MAX_MOUSE_JUMP || Math.abs(e.movementY) > MAX_MOUSE_JUMP) return;
    dx += e.movementX;
    dy += e.movementY;
  };
  const onChange = () => {
    reset();
    onLockChange?.(isLocked());
  };
  const onError = () => onLockError?.();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", reset);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("pointerlockchange", onChange);
  document.addEventListener("pointerlockerror", onError);

  return {
    // Movement state for one simulation tick (consumes a queued jump).
    read() {
      const held = (action) => BINDINGS[action].some(code => down.has(code));
      const state = {
        forward: held("forward"), back: held("back"), left: held("left"), right: held("right"),
        sprint: held("sprint"), crouch: held("crouch"), jump: jumpQueued,
      };
      jumpQueued = false;
      return state;
    },
    // Weapon controls for one tick (consumes queued presses).
    readWeapon() {
      const state = { fire: fireHeld || fireQueued, ads: adsHeld, reload: reloadQueued, slot: slotQueued, scroll, lastWeapon: lastQueued };
      fireQueued = reloadQueued = lastQueued = false;
      slotQueued = null;
      scroll = 0;
      return state;
    },
    // Arrow keys held: [turn, pitch], each -1/0/1 (right / down positive,
    // matching mouse movement).
    keyLook() {
      return [
        (down.has("ArrowRight") ? 1 : 0) - (down.has("ArrowLeft") ? 1 : 0),
        (down.has("ArrowDown") ? 1 : 0) - (down.has("ArrowUp") ? 1 : 0),
      ];
    },
    // Mouse movement (pixels) since the last call.
    takeLook() {
      const out = [dx, dy];
      dx = dy = 0;
      return out;
    },
    // Must be called from a user gesture (click). Raw, un-accelerated mouse
    // input where the browser supports it; plain lock otherwise. Fails (and
    // reports it) if the browser's short cooldown after Esc hasn't passed.
    lock() {
      try {
        const req = lockTarget.requestPointerLock({ unadjustedMovement: true });
        req?.catch?.((err) => {
          if (err?.name !== "NotSupportedError") return onError();
          lockTarget.requestPointerLock()?.catch?.(onError);
        });
      } catch {
        onError();
      }
    },
    unlock() {
      if (isLocked()) document.exitPointerLock();
    },
    isLocked,
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", reset);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onChange);
      document.removeEventListener("pointerlockerror", onError);
      if (isLocked()) document.exitPointerLock();
    },
  };
}
