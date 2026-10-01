import { BackgroundDock } from "../../../../Utils/KeepAlive";
import styles from "../MusicPlayer.module.css";

// Floating "now playing" chip shown while the Music Player is kept alive in
// the background (see Utils/KeepAlive.jsx), in the shared bottom-left dock.
export default function MiniPlayer({ track, isPlaying, onTogglePlay, onNext, onOpen, onClose }) {
  return (
    <BackgroundDock>
      <div className={styles.miniPlayer} role="region" aria-label="Music Player">
        <button type="button" className={styles.miniTitle} onClick={onOpen} title="Open Music Player">
          <span aria-hidden="true">🎵</span>
          <span className={styles.miniTitleText}>{track.title}</span>
        </button>
        <button type="button" className={styles.miniBtn} onClick={onTogglePlay} title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button type="button" className={styles.miniBtn} onClick={onNext} title="Next">⏭</button>
        <button type="button" className={styles.miniBtn} onClick={onClose} title="Stop and close">✕</button>
      </div>
    </BackgroundDock>
  );
}
