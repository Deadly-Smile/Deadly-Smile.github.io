import styles from "../MusicPlayer.module.css";

export default function VolumeSlider({ volume, onChange }) {
  return (
    <div className={styles.volumeRow}>
      <span className={styles.volumeIcon}>{volume === 0 ? "🔇" : "🔊"}</span>
      <input
        type="range"
        className={styles.range}
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Volume"
      />
    </div>
  );
}
