import { useEffect, useRef, useState } from "react";
import { estimateOdds } from "./odds";

// Odds are estimated in a Web Worker (oddsWorker.js); if it can't start, the
// same function runs on the main thread instead.
let worker = null;
let nextRequestId = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL("./oddsWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      const p = pending.get(id);
      pending.delete(id);
      if (!p) return;
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    };
    worker.onerror = () => {
      // Worker failed to load: settle anything waiting and fall back to the main thread.
      for (const p of pending.values()) p.reject(new Error("worker failed"));
      pending.clear();
      worker = false;
    };
  } catch {
    worker = false;
  }
  return worker;
}

function computeOdds(input) {
  const w = getWorker();
  if (!w) return new Promise(resolve => setTimeout(() => resolve(estimateOdds(input)), 0));
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId;
    pending.set(id, { resolve, reject });
    w.postMessage({ id, ...input });
  }).catch(() => estimateOdds(input));
}

// Recomputes only when the cards or the number of live opponents change.
export function useOdds(hole, board, opponents) {
  const key = hole.length === 2 && opponents > 0
    ? `${hole.map(c => c.rank + c.suit).join()}|${board.map(c => c.rank + c.suit).join()}|${opponents}`
    : null;
  const [state, setState] = useState({ key: null, odds: null });
  const inputRef = useRef(null);
  inputRef.current = { hole, board, opponents };

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    computeOdds(inputRef.current).then(odds => { if (!cancelled) setState({ key, odds }); });
    return () => { cancelled = true; };
  }, [key]);

  return state.key === key ? state.odds : null;
}
