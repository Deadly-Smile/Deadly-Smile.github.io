// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the keyboard shortcut mapping. Run manually with:
//   node src/Pages/tools/MusicPlayer/shortcuts.test.js
import { actionForKey, classifyTarget } from "./shortcuts.js";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`✗ ${name}`);
    console.error("  expected:", JSON.stringify(expected));
    console.error("  actual:  ", JSON.stringify(actual));
  } else {
    console.log(`✓ ${name}`);
  }
}

const key = (k, extra = {}) => ({ key: k, code: "", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...extra });
const on = { onScreen: true };
const off = { onScreen: false };

// ── media keys work everywhere, even while typing ──
check("media play/pause on screen", actionForKey(key("MediaPlayPause"), on), "toggle");
check("media play/pause in background", actionForKey(key("MediaPlayPause"), off), "toggle");
check("media next while typing", actionForKey(key("MediaTrackNext"), { onScreen: false, target: "typing" }), "next");
check("media stop pauses", actionForKey(key("MediaStop"), off), "pause");

// ── Alt+Shift globals ──
check("Alt+Shift+P in background", actionForKey(key("Π", { code: "KeyP", altKey: true, shiftKey: true }), off), "toggle");
check("Alt+Shift+N on screen", actionForKey(key("N", { code: "KeyN", altKey: true, shiftKey: true }), on), "next");
check("Alt+Shift+B", actionForKey(key("B", { code: "KeyB", altKey: true, shiftKey: true }), off), "previous");
check("Ctrl+Alt+Shift+P ignored", actionForKey(key("P", { code: "KeyP", altKey: true, shiftKey: true, ctrlKey: true }), off), null);
check("Alt+Shift+P ignored while typing", actionForKey(key("P", { code: "KeyP", altKey: true, shiftKey: true }), { onScreen: true, target: "typing" }), null);

// ── on-screen single keys ──
check("Space toggles on screen", actionForKey(key(" "), on), "toggle");
check("K toggles (uppercase via caps lock)", actionForKey(key("K"), on), "toggle");
check("J seeks back", actionForKey(key("j"), on), "seekBack");
check("L seeks forward", actionForKey(key("l"), on), "seekForward");
check("M mutes", actionForKey(key("m"), on), "mute");
check("ArrowUp volume", actionForKey(key("ArrowUp"), on), "volumeUp");
check("N next", actionForKey(key("n"), on), "next");
check("P previous", actionForKey(key("p"), on), "previous");

// ── on-screen keys are ignored where they would clash ──
check("Space ignored in background (games use it)", actionForKey(key(" "), off), null);
check("K ignored in background", actionForKey(key("k"), off), null);
check("Space ignored on a focused button", actionForKey(key(" "), { onScreen: true, target: "interactive" }), null);
check("K still works on a focused button", actionForKey(key("k"), { onScreen: true, target: "interactive" }), "toggle");
check("letters ignored while typing", actionForKey(key("k"), { onScreen: true, target: "typing" }), null);
check("Ctrl+K ignored", actionForKey(key("k", { ctrlKey: true }), on), null);
check("Shift+N ignored", actionForKey(key("N", { shiftKey: true }), on), null);
check("unmapped key", actionForKey(key("x"), on), null);

// ── classifyTarget ──
check("input is typing", classifyTarget({ tagName: "INPUT" }), "typing");
check("contenteditable is typing", classifyTarget({ tagName: "DIV", isContentEditable: true }), "typing");
check("button is interactive", classifyTarget({ tagName: "BUTTON" }), "interactive");
check("body is other", classifyTarget({ tagName: "BODY" }), "other");
check("null is other", classifyTarget(null), "other");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
