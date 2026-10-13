import { useEffect, useState } from "react";

// The element's playback position as state, for the one component that shows
// it (the seek bar) — so only that component re-renders on every "timeupdate"
// instead of the whole player. Seeks and source swaps fire these events too.
const EVENTS = ["timeupdate", "seeked", "emptied", "loadedmetadata"];

export function useAudioTime(audioRef) {
  const [time, setTime] = useState(() => audioRef.current?.currentTime ?? 0);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setTime(audio.currentTime);
    update();
    for (const e of EVENTS) audio.addEventListener(e, update);
    return () => { for (const e of EVENTS) audio.removeEventListener(e, update); };
  }, [audioRef]);
  return time;
}
