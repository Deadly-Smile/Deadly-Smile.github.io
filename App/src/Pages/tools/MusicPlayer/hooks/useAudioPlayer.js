import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, getLastState, saveLastState } from "../storage";
import { resumeAudioGraph } from "./useVisualizer";

const LAST_STATE_SAVE_INTERVAL_SECONDS = 4;

// Chromium drops a media element from the page's media session once it has
// *ended* (MPRIS/OS controls then show "Stopped" and media keys stop reaching
// the page), whereas a *paused* element stays controllable. After the queue
// runs out, a muted play → pause turns the rewound track back into a paused
// player. Verified against Chromium's MPRIS interface on Linux.
function rearmMediaSession(audio, rearmingRef) {
  rearmingRef.current = true;
  const wasMuted = audio.muted;
  audio.muted = true;
  audio.play()
    .then(() => audio.pause())
    .catch(() => {})
    .finally(() => {
      audio.muted = wasMuted;
      rearmingRef.current = false;
    });
}

export function useAudioPlayer(track, { repeatMode, onNaturalEnd } = {}) {
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.volume = getSettings().volume;
  }

  const objectUrlRef = useRef(null);
  const hasHydratedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const lastSaveRef = useRef(0);
  const suppressPauseRef = useRef(false);
  const autoAdvanceRef = useRef(false);
  const rearmingRef = useRef(false);
  const rearmPendingRef = useRef(false);

  const trackRef = useRef(track);
  trackRef.current = track;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const onNaturalEndRef = useRef(onNaturalEnd);
  onNaturalEndRef.current = onNaturalEnd;

  const [isPlaying, setIsPlaying] = useState(false);
  // The playback position deliberately isn't state here: "timeupdate" fires
  // ~4×/s, and holding it in this hook re-rendered the whole player (track
  // lists included) on every tick. Components that show it subscribe with
  // useAudioTime(); handlers read getCurrentTime().
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => getSettings().volume);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Native <audio> event wiring — runs once, refs carry the latest track/repeatMode/callback.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.currentTime - lastSaveRef.current >= LAST_STATE_SAVE_INTERVAL_SECONDS) {
        lastSaveRef.current = audio.currentTime;
        saveLastState({ lastTrackId: trackRef.current?.id ?? null, lastPositionSeconds: audio.currentTime });
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        const { lastTrackId, lastPositionSeconds } = getLastState();
        if (trackRef.current && lastTrackId === trackRef.current.id && lastPositionSeconds > 0) {
          audio.currentTime = lastPositionSeconds;
        }
      }
    };

    const handleEnded = () => {
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        // Reaching the end of a track fires a genuine "pause" event per spec
        // (paused is set true right before "ended"), which would otherwise
        // make the upcoming auto-advance look like nothing was playing.
        autoAdvanceRef.current = true;
        onNaturalEndRef.current?.();
      }
    };

    const handlePlay = () => {
      if (rearmingRef.current) return; // muted re-arm blip, not a real play
      suppressPauseRef.current = false;
      setIsPlaying(true);
    };
    const handlePause = () => {
      if (suppressPauseRef.current) {
        suppressPauseRef.current = false;
        return;
      }
      setIsPlaying(false);
      saveLastState({ lastTrackId: trackRef.current?.id ?? null, lastPositionSeconds: audio.currentTime });
    };
    const handleError = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      audio.pause();
      saveLastState({ lastTrackId: trackRef.current?.id ?? null, lastPositionSeconds: audio.currentTime });
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Track switch — swap the source on the SAME <audio> element (never recreate it,
  // since AudioContext.createMediaElementSource can only be called once per element).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    const previousUrl = objectUrlRef.current;
    const url = URL.createObjectURL(track.fileBlob);
    objectUrlRef.current = url;

    const shouldResume = isPlayingRef.current || autoAdvanceRef.current;
    autoAdvanceRef.current = false;
    const rearmAfterLoad = !shouldResume && rearmPendingRef.current;
    rearmPendingRef.current = false;
    if (shouldResume) suppressPauseRef.current = true;
    // Assigning .src already triggers the browser's load algorithm; an
    // explicit .load() right before .play() can abort that pending play()
    // with a spurious "interrupted by a new load request" error.
    audio.src = url;
    setDuration(0);
    // Revoke the OLD blob URL only now that audio.src no longer points at
    // it — revoking it while it was still the active src (as before) fires
    // a real "error" event on the element and force-pauses playback.
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    if (rearmAfterLoad) {
      const rearmLoaded = () => { if (objectUrlRef.current === url) rearmMediaSession(audio, rearmingRef); };
      audio.addEventListener("loadeddata", rearmLoaded, { once: true });
      return () => audio.removeEventListener("loadeddata", rearmLoaded);
    }
    if (!shouldResume) return;

    // The new resource has no data yet immediately after swapping src —
    // calling play() right away can get silently rejected. Wait until the
    // element actually has playable data before attempting to resume.
    const attemptResume = () => {
      if (objectUrlRef.current !== url) return;
      audio.play().catch(() => {
        if (objectUrlRef.current !== url) return;
        suppressPauseRef.current = false;
        setIsPlaying(false);
      });
    };
    audio.addEventListener("loadeddata", attemptResume, { once: true });
    return () => audio.removeEventListener("loadeddata", attemptResume);
  }, [track?.id]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.src) return; // nothing loaded yet
    resumeAudioGraph();
    audio.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else pause();
  }, [play, pause]);

  // End of the queue: whatever track is current next stays loaded but
  // paused at 0:00. Must run in the same handler that changes the track, so
  // the track-switch effect sees "not playing" and doesn't auto-resume.
  // `trackChanges`: the queue moved to a different track (re-arm after it loads).
  const stopAtEnd = useCallback(({ trackChanges = false } = {}) => {
    autoAdvanceRef.current = false;
    isPlayingRef.current = false;
    const audio = audioRef.current;
    if (!audio) return;
    const ended = audio.ended;
    audio.pause();
    audio.currentTime = 0;
    if (!ended) return;
    if (trackChanges) rearmPendingRef.current = true;
    else rearmMediaSession(audio, rearmingRef);
  }, []);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
  }, []);

  const getCurrentTime = useCallback(() => audioRef.current?.currentTime ?? 0, []);

  const setVolume = useCallback((v) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = v;
    setVolumeState(v);
    saveSettings({ ...getSettings(), volume: v });
  }, []);

  return { audioRef, isPlaying, getCurrentTime, duration, volume, play, pause, togglePlay, stopAtEnd, seek, setVolume };
}