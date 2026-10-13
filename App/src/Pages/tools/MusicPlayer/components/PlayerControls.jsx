import styles from "../MusicPlayer.module.css";
import VolumeSlider from "./VolumeSlider";
import { formatTime } from "../utils";
import { SHORTCUT_HELP } from "../shortcuts";
import { useAudioTime } from "../hooks/useAudioTime";

const REPEAT_ICONS = { off: "🔁", all: "🔁", one: "🔂" };
const REPEAT_LABELS = { off: "Repeat Off", all: "Repeat All", one: "Repeat One" };

// Its own component so the ~4×/s position updates re-render only this row.
function SeekRow({ audioRef, duration, onSeek, disabled }) {
  const currentTime = useAudioTime(audioRef);
  return (
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
        disabled={disabled}
        aria-label="Seek"
      />
      <span className={styles.timeLabel}>{formatTime(duration)}</span>
    </div>
  );
}

export default function PlayerControls({
  currentTrack,
  isPlaying,
  audioRef,
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

      <SeekRow audioRef={audioRef} duration={duration} onSeek={onSeek} disabled={!currentTrack} />

      <div className={styles.transportControls}>
        <button
          type="button"
          className={`${styles.controlBtn} ${shuffle ? styles.controlBtnActive : ""}`}
          onClick={onToggleShuffle}
          title="Shuffle"
        >
          🔀
        </button>
        <button type="button" className={styles.controlBtn} onClick={onPrevious} title="Previous (P)" disabled={!currentTrack}>
          ⏮
        </button>
        <button type="button" className={styles.controlBtn} onClick={onTogglePlay} title={`${isPlaying ? "Pause" : "Play"} (Space)`} disabled={!currentTrack}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button type="button" className={styles.controlBtn} onClick={onNext} title="Next (N)" disabled={!currentTrack}>
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

      <details className={styles.shortcutHelp}>
        <summary>⌨ Keyboard shortcuts</summary>
        <dl>
          {SHORTCUT_HELP.map(([keys, what]) => (
            <div key={keys} style={{ display: "contents" }}>
              <dt>{keys}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
