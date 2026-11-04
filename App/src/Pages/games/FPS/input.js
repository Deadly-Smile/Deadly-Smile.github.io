// ─── Keyboard + mouse (pointer lock) ────────────────────────────────────────
// Keys are read by `code`, i.e. physical position, so WASD stays WASD on
// AZERTY and other layouts. Nothing is read unless the pointer is locked to
// the game, so typing elsewhere on the page never moves the player.
const BINDINGS = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
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

  const isLocked = () => document.pointerLockElement === lockTarget;
  const reset = () => {
    down.clear();
    jumpQueued = false;
    dx = dy = 0;
  };

  const onKeyDown = (e) => {
    if (!isLocked()) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.code === "Space" && !e.repeat) jumpQueued = true;
    down.add(e.code);
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
      document.removeEventListener("pointerlockchange", onChange);
      document.removeEventListener("pointerlockerror", onError);
      if (isLocked()) document.exitPointerLock();
    },
  };
}
