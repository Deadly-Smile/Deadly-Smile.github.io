import styles from "../MusicPlayer.module.css";
import { formatTime } from "../utils";

export default function TrackList({ tracks, currentTrackId, isPlaying, onPlay, onDelete }) {
  if (tracks.length === 0) {
    return <p style={{ color: "var(--tk-text-dim)", fontSize: "0.85rem" }}>No tracks yet — upload some audio files to get started.</p>;
  }

  return (
    <ul className={styles.trackList}>
      {tracks.map((track) => {
        const isCurrent = track.id === currentTrackId;
        return (
          <li key={track.id} className={`${styles.trackRow} ${isCurrent ? styles.trackRowActive : ""}`}>
            <button type="button" className={styles.trackPlayBtn} onClick={() => onPlay(track.id)}>
              {isCurrent && isPlaying ? "⏸" : "▶"}
            </button>
            <div className={styles.trackInfo}>
              <div className={styles.trackTitle}>{track.title}</div>
              {track.artist && <div className={styles.trackArtist}>{track.artist}</div>}
            </div>
            <span className={styles.trackDuration}>{formatTime(track.duration)}</span>
            <button type="button" className={styles.trackDeleteBtn} onClick={() => onDelete(track.id)} title="Delete track">
              🗑
            </button>
          </li>
        );
      })}
    </ul>
  );
}
