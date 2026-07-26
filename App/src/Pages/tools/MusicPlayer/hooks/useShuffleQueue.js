import { useCallback, useRef, useState } from "react";
import { fisherYatesShuffle } from "../utils";
import { getSettings, saveSettings } from "../storage";

const TRANSITION_GUARD_MS = 250;

export function useShuffleQueue() {
  const [queueIds, setQueueIds] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [history, setHistory] = useState([]);
  const [shuffledUpcoming, setShuffledUpcoming] = useState([]);
  const [shuffle, setShuffleFlag] = useState(() => getSettings().shuffle);
  const isTransitioningRef = useRef(false);

  // Guards next()/previous() against rapid double-invocation so overlapping
  // calls can't race the shared <audio> element / AudioContext state.
  const guard = (fn) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    fn();
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, TRANSITION_GUARD_MS);
  };

  const setQueue = useCallback(
    (ids, startId) => {
      setQueueIds(ids);
      setCurrentId(startId);
      setHistory([]);
      setShuffledUpcoming(shuffle ? fisherYatesShuffle(ids.filter((id) => id !== startId)) : []);
    },
    [shuffle]
  );

  const next = useCallback(
    ({ repeatAll = false } = {}) => {
      guard(() => {
        if (currentId != null) setHistory((h) => [...h, currentId]);

        if (shuffle) {
          let upcoming = shuffledUpcoming;
          if (upcoming.length === 0) {
            if (!repeatAll) {
              setCurrentId(null);
              return;
            }
            upcoming = fisherYatesShuffle(queueIds.filter((id) => id !== currentId));
          }
          const [head, ...rest] = upcoming;
          setShuffledUpcoming(rest);
          setCurrentId(head ?? null);
          return;
        }

        const idx = queueIds.indexOf(currentId);
        const nextIdx = idx + 1;
        if (nextIdx < queueIds.length) {
          setCurrentId(queueIds[nextIdx]);
        } else if (repeatAll && queueIds.length > 0) {
          setCurrentId(queueIds[0]);
        } else {
          setCurrentId(null);
        }
      });
    },
    [currentId, shuffle, shuffledUpcoming, queueIds]
  );

  const previous = useCallback(() => {
    guard(() => {
      setHistory((h) => {
        if (h.length === 0) return h;
        setCurrentId(h[h.length - 1]);
        return h.slice(0, -1);
      });
    });
  }, []);

  // Turning shuffle on mid-playback keeps the current track in place and only
  // shuffles what's left (queueIds minus history minus currentId) — history
  // itself is never rewritten by any shuffle operation.
  const toggleShuffle = useCallback(() => {
    setShuffleFlag((prev) => {
      const next = !prev;
      saveSettings({ ...getSettings(), shuffle: next });
      if (next) {
        const remainder = queueIds.filter((id) => id !== currentId && !history.includes(id));
        setShuffledUpcoming(fisherYatesShuffle(remainder));
      } else {
        setShuffledUpcoming([]);
      }
      return next;
    });
  }, [queueIds, currentId, history]);

  return { queueIds, currentId, history, shuffle, setQueue, next, previous, toggleShuffle };
}
