import { useCallback, useEffect, useRef, useState } from "react";

// localStorage-backed useState. Values are stored as { v, data } under
// "app:<key>" — a version mismatch (the stored shape changed in a refactor)
// falls back to `initial` instead of handing a component data it can't read.
// Every storage access is guarded: localStorage can throw (quota, privacy mode).

const PREFIX = "app:";

export function readPersisted(key, fallback, version = 1) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed?.v === version ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writePersisted(key, data, version = 1) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v: version, data }));
    return true;
  } catch {
    return false;
  }
}

export function removePersisted(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* storage unavailable */ }
}

// `key` is expected to be stable for the component's lifetime.
// Writes are debounced (fast typing shouldn't hit storage per keystroke) and
// flushed on unmount / pagehide so the last edit is never lost.
export function usePersistentState(key, initial, { version = 1, debounceMs = 250 } = {}) {
  const [value, setValue] = useState(() =>
    readPersisted(key, typeof initial === "function" ? initial() : initial, version)
  );

  const pendingRef = useRef(null); // { value } awaiting a write
  const configRef = useRef({ key, version });
  configRef.current = { key, version };
  const skipFirstRef = useRef(true);

  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    const { key, version } = configRef.current;
    writePersisted(key, pendingRef.current.value, version);
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    // The first render's value was just read from storage — don't write it back.
    if (skipFirstRef.current) { skipFirstRef.current = false; return; }
    pendingRef.current = { value };
    if (!debounceMs) { flush(); return; }
    const t = setTimeout(flush, debounceMs);
    return () => clearTimeout(t);
  }, [value, debounceMs, flush]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return [value, setValue];
}
