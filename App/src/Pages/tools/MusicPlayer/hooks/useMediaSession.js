import { useEffect, useRef } from "react";

const SEEK_STEP_SECONDS = 10;

// Media Session API: tells the OS this page is a music player. On Android it
// shows the track in the media notification / lock screen with working
// play/pause/next/previous/seek, routes headset and Bluetooth buttons here,
// and makes Chrome far less likely to freeze or discard the backgrounded tab.
export function useMediaSession({ track, coverBlob, isPlaying, audioRef, getCurrentTime, duration, onPlay, onPause, onNext, onPrevious, onSeek }) {
  const supported = typeof navigator !== "undefined" && "mediaSession" in navigator;

  // Handlers are registered once; refs carry the latest callbacks/time.
  const latest = useRef({});
  latest.current = { getCurrentTime, duration, onPlay, onPause, onNext, onPrevious, onSeek };

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
      // Some OSes send "stop" (e.g. a headset long-press); pausing keeps the
      // session alive so the next play key still reaches this page.
      stop: () => latest.current.onPause(),
      nexttrack: () => latest.current.onNext(),
      previoustrack: () => latest.current.onPrevious(),
      seekto: (e) => { if (Number.isFinite(e.seekTime)) seekTo(e.seekTime); },
      seekbackward: (e) => seekTo(latest.current.getCurrentTime() - (e.seekOffset || SEEK_STEP_SECONDS)),
      seekforward: (e) => seekTo(latest.current.getCurrentTime() + (e.seekOffset || SEEK_STEP_SECONDS)),
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

  // Track metadata + album cover as notification artwork. Re-applied on every
  // play/pause too: other media on the page (P2P Chat's call <video>s, also
  // kept alive) can take over the session, and re-asserting the metadata
  // hands it back to the music.
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
  }, [supported, track, coverBlob, isPlaying]);

  useEffect(() => {
    if (!supported) return;
    navigator.mediaSession.playbackState = track ? (isPlaying ? "playing" : "paused") : "none";
  }, [supported, track, isPlaying]);

  // Position for the notification's progress bar. The OS extrapolates while
  // playing, so this only needs refreshing on play/pause, track change and
  // seeks — the latter straight off the element's "seeked" event, since the
  // position isn't React state (see useAudioPlayer).
  useEffect(() => {
    if (!supported || !navigator.mediaSession.setPositionState) return;
    if (!track || !Number.isFinite(duration) || duration <= 0) return;
    const sync = () => {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(Math.max(0, latest.current.getCurrentTime()), duration),
        });
      } catch { /* invalid state mid-load */ }
    };
    sync();
    const audio = audioRef?.current;
    audio?.addEventListener("seeked", sync);
    return () => audio?.removeEventListener("seeked", sync);
  }, [supported, track, isPlaying, duration, audioRef]);
}
