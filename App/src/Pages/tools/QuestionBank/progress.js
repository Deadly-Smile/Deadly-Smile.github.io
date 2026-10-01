// Personal, per-device study data, keyed by Supabase question id:
//   { [id]: { fav, read, shown, correct, wrong, lastResult, lastAt } }
// Kept separate from the synced question content (which is read-only), so a
// sync never touches it. Entries for questions deleted remotely are simply
// ignored, and come back to life if the question is restored.
// Every function here is pure and returns a new progress object.

export const EMPTY_ENTRY = Object.freeze({
  fav: false, read: false, shown: 0, correct: 0, wrong: 0, lastResult: null, lastAt: null,
});

export function getEntry(progress, id) {
  return progress[id] ? { ...EMPTY_ENTRY, ...progress[id] } : EMPTY_ENTRY;
}

export function withAttempt(progress, id, wasCorrect, now = Date.now()) {
  const e = getEntry(progress, id);
  return {
    ...progress,
    [id]: {
      ...e,
      read: true,
      shown: e.shown + 1,
      correct: e.correct + (wasCorrect ? 1 : 0),
      wrong: e.wrong + (wasCorrect ? 0 : 1),
      lastResult: wasCorrect ? "correct" : "wrong",
      lastAt: now,
    },
  };
}

export function withFlag(progress, id, flag, value) {
  const e = getEntry(progress, id);
  return { ...progress, [id]: { ...e, [flag]: value ?? !e[flag] } };
}

export const isFavorite = e => e.fav;
export const isUnseen = e => e.shown === 0 && !e.read;
// "Wrong" means still wrong: the latest attempt failed. A question you've
// since answered correctly drops out of the review pool.
export const isWrong = e => e.lastResult === "wrong";
