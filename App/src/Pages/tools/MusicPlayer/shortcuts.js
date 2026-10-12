// Keyboard → player action mapping (pure, see shortcuts.test.js).
//
// - Media keys (⏯ ⏭ ⏮ ⏹) work everywhere, as a fallback for browsers/OSes
//   where the Media Session API doesn't pick them up.
// - Alt+Shift+P / N / B work everywhere, including while the player is
//   parked in the background (matched on `code`, since Alt/Shift change
//   `key` on some layouts).
// - Single-letter keys only while the player is on screen, so they never
//   clash with games/tools that use Space or letters themselves.

export const SEEK_STEP_SECONDS = 10;
export const VOLUME_STEP = 0.1;

export const SHORTCUT_HELP = [
  ["Space / K", "Play / pause"],
  ["J / L", `Seek −${SEEK_STEP_SECONDS}s / +${SEEK_STEP_SECONDS}s`],
  ["P / N", "Previous / next track"],
  ["↑ / ↓", "Volume up / down"],
  ["M", "Mute / unmute"],
  ["Alt+Shift+P", "Play / pause (from any page)"],
  ["Alt+Shift+N / B", "Next / previous (from any page)"],
  ["⏯ ⏭ ⏮", "Keyboard / headset media keys"],
];

const MEDIA_KEYS = {
  MediaPlayPause: "toggle",
  MediaPlay: "play",
  MediaPause: "pause",
  MediaStop: "pause",
  MediaTrackNext: "next",
  MediaTrackPrevious: "previous",
};

const GLOBAL_CODES = { KeyP: "toggle", KeyN: "next", KeyB: "previous" };

const ON_SCREEN_KEYS = {
  " ": "toggle",
  k: "toggle",
  j: "seekBack",
  l: "seekForward",
  n: "next",
  p: "previous",
  m: "mute",
  ArrowUp: "volumeUp",
  ArrowDown: "volumeDown",
};

// target: "typing" (input/textarea/select/contenteditable),
//         "interactive" (button/link — Space would also click it), or "other".
export function actionForKey(event, { onScreen, target = "other" }) {
  if (MEDIA_KEYS[event.key]) return MEDIA_KEYS[event.key];
  if (target === "typing") return null;
  if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
    return GLOBAL_CODES[event.code] ?? null;
  }
  if (!onScreen || event.altKey || event.ctrlKey || event.metaKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === " " && target === "interactive") return null;
  if (event.shiftKey && key !== " ") return null;
  return ON_SCREEN_KEYS[key] ?? null;
}

export function classifyTarget(el) {
  if (!el || !el.tagName) return "other";
  if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return "typing";
  if (["BUTTON", "A", "SUMMARY"].includes(el.tagName)) return "interactive";
  return "other";
}
