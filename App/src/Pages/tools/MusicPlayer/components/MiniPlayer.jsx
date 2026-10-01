import { createPortal } from "react-dom";
import { useLocation } from "../../../../Utils/router";
import styles from "../MusicPlayer.module.css";

// Floating "now playing" chip shown while the Music Player is kept alive in
// the background (see Utils/KeepAlive.jsx). Portaled to <body> because the
// player's own DOM is detached while it is off screen.
export default function MiniPlayer({ track, isPlaying, onTogglePlay, onNext, onOpen, onClose }) {
  const { pathname } = useLocation();
  const raised = pathname.startsWith("/white-board");
  return createPortal(
    <div className={`${styles.miniPlayer} ${raised ? styles.miniPlayerRaised : ""}`} role="region" aria-label="Music Player">
      <button type="button" className={styles.miniTitle} onClick={onOpen} title="Open Music Player">
        <span aria-hidden="true">🎵</span>
        <span className={styles.miniTitleText}>{track.title}</span>
      </button>
      <button type="button" className={styles.miniBtn} onClick={onTogglePlay} title={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? "⏸" : "▶"}
      </button>
      <button type="button" className={styles.miniBtn} onClick={onNext} title="Next">⏭</button>
      <button type="button" className={styles.miniBtn} onClick={onClose} title="Stop and close">✕</button>
    </div>,
    document.body
  );
}
