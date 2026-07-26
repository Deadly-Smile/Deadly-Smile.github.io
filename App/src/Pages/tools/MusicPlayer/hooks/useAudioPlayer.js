import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, getLastState, saveLastState } from "../storage";

const LAST_STATE_SAVE_INTERVAL_SECONDS = 4;

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

  const trackRef = useRef(track);
  trackRef.current = track;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const onNaturalEndRef = useRef(onNaturalEnd);
  onNaturalEndRef.current = onNaturalEnd;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
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
      setCurrentTime(audio.currentTime);
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
          setCurrentTime(lastPositionSeconds);
        }
      }
    };

    const handleEnded = () => {
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        onNaturalEndRef.current?.();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
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

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(track.fileBlob);
    objectUrlRef.current = url;

    const shouldResume = isPlayingRef.current;
    audio.src = url;
    audio.load();
    setCurrentTime(0);
    setDuration(0);

    if (shouldResume) {
      audio.play().catch(() => {});
    }
  }, [track?.id]);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
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

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((v) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = v;
    setVolumeState(v);
    saveSettings({ ...getSettings(), volume: v });
  }, []);

  return { audioRef, isPlaying, currentTime, duration, volume, play, pause, togglePlay, seek, setVolume };
}
