import { useState } from "react";
import { Modal, ConfirmModal } from "../../../../Utils/Modal";
import { resolveTracks, formatTime } from "../utils";
import AlbumCoverPicker from "./AlbumCoverPicker";
import AlbumCoverImage from "./AlbumCoverImage";
import styles from "../MusicPlayer.module.css";

export default function AlbumView({
  albums,
  tracks,
  currentTrackId,
  onCreate,
  onDelete,
  onAssignTrack,
  onRemoveTrack,
  onPlay,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCover, setNewCover] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const tracksById = new Map(tracks.map((t) => [t.id, t]));
  const selected = albums.find((a) => a.id === selectedId) ?? null;

  const closeCreate = () => {
    setShowCreate(false);
    setNewName("");
    setNewCover(null);
  };

  const handleCreateSubmit = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newCover);
    closeCreate();
  };

  if (selected) {
    const resolvedTracks = resolveTracks(selected.trackIds, tracksById);
    const unassigned = tracks.filter((t) => t.albumId !== selected.id);

    return (
      <div>
        <div className={styles.detailHeader}>
          <button type="button" className={styles.controlBtn} onClick={() => setSelectedId(null)}>← Back</button>
          <AlbumCoverImage blob={selected.coverImageBlob} className={styles.cardCover} placeholderClassName={styles.coverPlaceholder} />
          <h3>{selected.name}</h3>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => onPlay(selected.id)}
            disabled={resolvedTracks.length === 0}
          >
            ▶ Play
          </button>
          <button type="button" className={styles.controlBtn} onClick={() => setDeleteTarget(selected)}>
            Delete
          </button>
        </div>

        {unassigned.length > 0 && (
          <select
            className={styles.trackSelect}
            value=""
            onChange={(e) => {
              if (e.target.value) onAssignTrack(selected.id, e.target.value);
            }}
          >
            <option value="">+ Assign track…</option>
            {unassigned.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}

        {resolvedTracks.length === 0 ? (
          <p style={{ color: "var(--tk-text-dim)", fontSize: "0.85rem" }}>No tracks in this album.</p>
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
                  onClick={() => onRemoveTrack(track.id)}
                  title="Remove from album"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {deleteTarget && (
          <ConfirmModal
            isOpen
            title="Delete Album"
            message={`Delete "${deleteTarget.name}"? Tracks will remain in your library.`}
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
        + New Album
      </button>
      {albums.length === 0 ? (
        <p style={{ color: "var(--tk-text-dim)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
          No albums yet.
        </p>
      ) : (
        <div className={styles.cardGrid}>
          {albums.map((album) => (
            <button key={album.id} type="button" className={styles.card} onClick={() => setSelectedId(album.id)}>
              <AlbumCoverImage blob={album.coverImageBlob} className={styles.cardCover} placeholderClassName={styles.coverPlaceholder} />
              <div className={styles.cardLabel}>{album.name}</div>
              <div className={styles.cardMeta}>{album.trackIds.length} tracks</div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal
          isOpen
          title="New Album"
          onClose={closeCreate}
          actions={[
            { label: "Cancel", onClick: () => {} },
            { label: "Create", primary: true, onClick: handleCreateSubmit, closeOnClick: false },
          ]}
        >
          <AlbumCoverPicker value={newCover} onChange={setNewCover} />
          <input
            type="text"
            placeholder="Album name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            className={styles.trackSelect}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </Modal>
      )}
    </div>
  );
}
