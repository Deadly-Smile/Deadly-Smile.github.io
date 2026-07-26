import styles from "../MusicPlayer.module.css";
import VolumeSlider from "./VolumeSlider";
import { formatTime } from "../utils";

const REPEAT_ICONS = { off: "🔁", all: "🔁", one: "🔂" };
const REPEAT_LABELS = { off: "Repeat Off", all: "Repeat All", one: "Repeat One" };

export default function PlayerControls({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
  onNext,
  onPrevious,
  shuffle,
  onToggleShuffle,
  repeatMode,
  onCycleRepeat,
  volume,
  onVolumeChange,
}) {
  return (
    <div className={styles.nowPlayingBar}>
      <div>
        <div className={styles.nowPlayingTitle}>
          {currentTrack ? currentTrack.title : "No track selected"}
        </div>
        {currentTrack?.artist && (
          <div className={styles.nowPlayingArtist}>{currentTrack.artist}</div>
        )}
      </div>

      <div className={styles.seekRow}>
        <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
        <input
          type="range"
          className={styles.range}
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
          disabled={!currentTrack}
          aria-label="Seek"
        />
        <span className={styles.timeLabel}>{formatTime(duration)}</span>
      </div>

      <div className={styles.transportControls}>
        <button
          type="button"
          className={`${styles.controlBtn} ${shuffle ? styles.controlBtnActive : ""}`}
          onClick={onToggleShuffle}
          title="Shuffle"
        >
          🔀
        </button>
        <button type="button" className={styles.controlBtn} onClick={onPrevious} title="Previous" disabled={!currentTrack}>
          ⏮
        </button>
        <button type="button" className={styles.controlBtn} onClick={onTogglePlay} title={isPlaying ? "Pause" : "Play"} disabled={!currentTrack}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button type="button" className={styles.controlBtn} onClick={onNext} title="Next" disabled={!currentTrack}>
          ⏭
        </button>
        <button
          type="button"
          className={`${styles.controlBtn} ${repeatMode !== "off" ? styles.controlBtnActive : ""}`}
          onClick={onCycleRepeat}
          title={REPEAT_LABELS[repeatMode]}
        >
          {REPEAT_ICONS[repeatMode]}
        </button>
        <VolumeSlider volume={volume} onChange={onVolumeChange} />
      </div>
    </div>
  );
}
