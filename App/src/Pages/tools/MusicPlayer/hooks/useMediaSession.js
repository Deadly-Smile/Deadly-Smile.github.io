import { useEffect, useRef } from "react";

const SEEK_STEP_SECONDS = 10;

// Media Session API: tells the OS this page is a music player. On Android it
// shows the track in the media notification / lock screen with working
// play/pause/next/previous/seek, routes headset and Bluetooth buttons here,
// and makes Chrome far less likely to freeze or discard the backgrounded tab.
export function useMediaSession({ track, coverBlob, isPlaying, currentTime, duration, onPlay, onPause, onNext, onPrevious, onSeek }) {
  const supported = typeof navigator !== "undefined" && "mediaSession" in navigator;

  // Handlers are registered once; refs carry the latest callbacks/time.
  const latest = useRef({});
  latest.current = { currentTime, duration, onPlay, onPause, onNext, onPrevious, onSeek };

  useEffect(() => {
    if (!supported) return;
    const ms = navigator.mediaSession;
    const seekTo = (t) => {
      const { duration, onSeek } = latest.current;
      onSeek(Math.max(0, duration ? Math.min(t, duration) : t));
    };
    const handlers = {
      play: () => latest.current.onPlay(),
      pause: () => latest.current.onPause(),
      nexttrack: () => latest.current.onNext(),
      previoustrack: () => latest.current.onPrevious(),
      seekto: (e) => { if (Number.isFinite(e.seekTime)) seekTo(e.seekTime); },
      seekbackward: (e) => seekTo(latest.current.currentTime - (e.seekOffset || SEEK_STEP_SECONDS)),
      seekforward: (e) => seekTo(latest.current.currentTime + (e.seekOffset || SEEK_STEP_SECONDS)),
    };
    for (const [action, fn] of Object.entries(handlers)) {
      try { ms.setActionHandler(action, fn); } catch { /* action unsupported by this browser */ }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try { ms.setActionHandler(action, null); } catch { /* unsupported */ }
      }
      ms.metadata = null;
      ms.playbackState = "none";
    };
  }, [supported]);

  // Track metadata + album cover as notification artwork.
  useEffect(() => {
    if (!supported) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const artUrl = coverBlob ? URL.createObjectURL(coverBlob) : null;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: track.title || "Unknown title",
      artist: track.artist || "",
      album: "",
      artwork: artUrl ? [{ src: artUrl, type: coverBlob.type || "image/jpeg" }] : [],
    });
    return () => { if (artUrl) URL.revokeObjectURL(artUrl); };
  }, [supported, track, coverBlob]);

  useEffect(() => {
    if (!supported) return;
    navigator.mediaSession.playbackState = track ? (isPlaying ? "playing" : "paused") : "none";
  }, [supported, track, isPlaying]);

  // Position for the notification's progress bar. The OS extrapolates while
  // playing, so this only needs refreshing on play/pause, track change and
  // seeks (a jump of more than a couple of seconds from the expected time).
  const lastSyncRef = useRef({ at: 0, pos: 0 });
  useEffect(() => {
    if (!supported || !navigator.mediaSession.setPositionState) return;
    if (!track || !Number.isFinite(duration) || duration <= 0) return;
    const now = performance.now();
    const { at, pos } = lastSyncRef.current;
    const expected = pos + (isPlaying ? (now - at) / 1000 : 0);
    const jumped = Math.abs(currentTime - expected) > 2;
    if (!jumped && at !== 0 && lastSyncRef.current.key === `${track.id}|${isPlaying}|${duration}`) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, currentTime), duration),
      });
      lastSyncRef.current = { at: now, pos: currentTime, key: `${track.id}|${isPlaying}|${duration}` };
    } catch { /* invalid state mid-load */ }
  }, [supported, track, isPlaying, currentTime, duration]);
}
