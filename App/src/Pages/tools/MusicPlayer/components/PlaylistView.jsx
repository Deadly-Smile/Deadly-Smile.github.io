import { useState } from "react";
import { InputModal, ConfirmModal } from "../../../../Utils/Modal";
import { resolveTracks, formatTime } from "../utils";
import styles from "../MusicPlayer.module.css";

export default function PlaylistView({
  playlists,
  tracks,
  currentTrackId,
  onCreate,
  onRename,
  onDelete,
  onAddTrack,
  onRemoveTrack,
  onPlay,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const tracksById = new Map(tracks.map((t) => [t.id, t]));
  const selected = playlists.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    const resolvedTracks = resolveTracks(selected.trackIds, tracksById);
    const addableTracks = tracks.filter((t) => !selected.trackIds.includes(t.id));

    return (
      <div>
        <div className={styles.detailHeader}>
          <button type="button" className={styles.controlBtn} onClick={() => setSelectedId(null)}>← Back</button>
          <h3>{selected.name}</h3>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => onPlay(selected.id)}
            disabled={resolvedTracks.length === 0}
          >
            ▶ Play
          </button>
          <button type="button" className={styles.controlBtn} onClick={() => setRenameTarget(selected)}>
            Rename
          </button>
          <button type="button" className={styles.controlBtn} onClick={() => setDeleteTarget(selected)}>
            Delete
          </button>
        </div>

        {addableTracks.length > 0 && (
          <select
            className={styles.trackSelect}
            value=""
            onChange={(e) => {
              if (e.target.value) onAddTrack(selected.id, e.target.value);
            }}
          >
            <option value="">+ Add track…</option>
            {addableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}

        {resolvedTracks.length === 0 ? (
          <p style={{ color: "var(--tk-text-dim)", fontSize: "0.85rem" }}>This playlist is empty.</p>
        ) : (
          <ul className={styles.trackList}>
            {resolvedTracks.map((track) => (
              <li
                key={track.id}
                className={`${styles.trackRow} ${track.id === currentTrackId ? styles.trackRowActive : ""}`}
              >
                <div className={styles.trackInfo}>
                  <div className={styles.trackTitle}>{track.title}</div>
                  {track.artist && <div className={styles.trackArtist}>{track.artist}</div>}
                </div>
                <span className={styles.trackDuration}>{formatTime(track.duration)}</span>
                <button
                  type="button"
                  className={styles.trackDeleteBtn}
                  onClick={() => onRemoveTrack(selected.id, track.id)}
                  title="Remove from playlist"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {renameTarget && (
          <InputModal
            isOpen
            title="Rename Playlist"
            defaultValue={renameTarget.name}
            onClose={() => setRenameTarget(null)}
            onSubmit={(name) => onRename(renameTarget.id, name)}
          />
        )}
        {deleteTarget && (
          <ConfirmModal
            isOpen
            title="Delete Playlist"
            message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
            danger
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => {
              onDelete(deleteTarget.id);
              setSelectedId(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className={styles.controlBtn} onClick={() => setShowCreate(true)}>
        + New Playlist
      </button>
      {playlists.length === 0 ? (
        <p style={{ color: "var(--tk-text-dim)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
          No playlists yet.
        </p>
      ) : (
        <div className={styles.cardGrid}>
          {playlists.map((pl) => (
            <button key={pl.id} type="button" className={styles.card} onClick={() => setSelectedId(pl.id)}>
              <div className={styles.cardIcon}>🎼</div>
              <div className={styles.cardLabel}>{pl.name}</div>
              <div className={styles.cardMeta}>{pl.trackIds.length} tracks</div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <InputModal
          isOpen
          title="New Playlist"
          placeholder="Playlist name"
          onClose={() => setShowCreate(false)}
          onSubmit={(name) => onCreate(name)}
        />
      )}
    </div>
  );
}
