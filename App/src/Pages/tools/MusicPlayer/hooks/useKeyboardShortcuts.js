import { useEffect, useRef } from "react";
import { actionForKey, classifyTarget } from "../shortcuts";

const REPEATABLE = new Set(["seekBack", "seekForward", "volumeUp", "volumeDown"]);

// Window-level shortcuts for the player (mapping in ../shortcuts.js). The
// listener lives as long as the kept-alive instance, so media keys and the
// Alt+Shift combos keep working while the player is in the background.
// perform(action, { mediaKey }) — mediaKey lets the caller de-duplicate
// against the Media Session handler, which some browsers fire for the same
// key press.
export function useKeyboardShortcuts(onScreen, perform) {
  const latest = useRef({ onScreen, perform });
  latest.current = { onScreen, perform };

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const { onScreen, perform } = latest.current;
      const action = actionForKey(e, { onScreen, target: classifyTarget(document.activeElement) });
      if (!action) return;
      e.preventDefault();
      // Holding a key repeats seek/volume steps, never toggles.
      if (e.repeat && !REPEATABLE.has(action)) return;
      perform(action, { mediaKey: e.key.startsWith("Media") });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
