import { useCallback, useEffect, useReducer, useState } from "react";
import { StatusBar } from "../tk-shared.jsx";
import { libraryReducer, initialLibraryState } from "./libraryReducer";
import {
  getAllTracks,
  getAllAlbums,
  getAllPlaylists,
  deleteTrack as dbDeleteTrack,
  putTrack,
  putPlaylist,
  deletePlaylist as dbDeletePlaylist,
  putAlbum,
  deleteAlbum as dbDeleteAlbum,
} from "./db/db";
import { getSettings, saveSettings, getLastState } from "./storage";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useShuffleQueue } from "./hooks/useShuffleQueue";
import { closeAudioGraph } from "./hooks/useVisualizer";
import UploadButton from "./components/UploadButton";
import TrackList from "./components/TrackList";
import PlaylistView from "./components/PlaylistView";
import AlbumView from "./components/AlbumView";
import PlayerControls from "./components/PlayerControls";
import Visualizer from "./components/Visualizer";
import styles from "./MusicPlayer.module.css";

const REPEAT_CYCLE = ["off", "all", "one"];
const TABS = [
  { id: "library", label: "Library" },
  { id: "playlists", label: "Playlists" },
  { id: "albums", label: "Albums" },
];

export default function MusicPlayer() {
  const [library, dispatch] = useReducer(libraryReducer, initialLibraryState);
  const [activeTab, setActiveTab] = useState("library");
  const [repeatMode, setRepeatMode] = useState(() => getSettings().repeatMode);
  const [status, setStatus] = useState(null);

  const shuffleQueue = useShuffleQueue();
  const currentTrack = library.tracks.find((t) => t.id === shuffleQueue.currentId) ?? null;

  const handleNaturalEnd = useCallback(() => {
    shuffleQueue.next({ repeatAll: repeatMode === "all" });
  }, [shuffleQueue, repeatMode]);

  const player = useAudioPlayer(currentTrack, { repeatMode, onNaturalEnd: handleNaturalEnd });

  useEffect(() => {
    dispatch({ type: "LOAD_START" });
    Promise.all([getAllTracks(), getAllAlbums(), getAllPlaylists()])
      .then(([tracks, albums, playlists]) => {
        dispatch({ type: "LOAD_SUCCESS", tracks, albums, playlists });
        const { lastTrackId } = getLastState();
        if (lastTrackId && tracks.some((t) => t.id === lastTrackId)) {
          shuffleQueue.setQueue(tracks.map((t) => t.id), lastTrackId);
        }
      })
      .catch((e) => dispatch({ type: "LOAD_ERROR", error: e.message }));
    // Runs once on mount — deliberately excludes shuffleQueue/dispatch from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The shared AudioContext singleton is torn down only when the whole tool
  // unmounts (user navigates away), not when Visualizer itself remounts on tab switches.
  useEffect(() => closeAudioGraph, []);

  const handlePlayTrack = (trackId) => {
    if (trackId === shuffleQueue.currentId) {
      player.togglePlay();
      return;
    }
    shuffleQueue.setQueue(
      library.tracks.map((t) => t.id),
      trackId
    );
  };

  const handleDeleteTrack = async (trackId) => {
    if (trackId === shuffleQueue.currentId) player.pause();
    await dbDeleteTrack(trackId);
    dispatch({ type: "DELETE_TRACK", id: trackId });
  };

  const handleTrackAdded = (track) => {
    dispatch({ type: "ADD_TRACK", track });
  };

  const handleCycleRepeat = () => {
    setRepeatMode((prev) => {
      const next = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(prev) + 1) % REPEAT_CYCLE.length];
      saveSettings({ ...getSettings(), repeatMode: next });
      return next;
    });
  };

  const savePlaylist = async (playlist) => {
    try {
      await putPlaylist(playlist);
      return true;
    } catch (e) {
      setStatus({ msg: e.message, type: "err" });
      return false;
    }
  };

  const handleCreatePlaylist = async (name) => {
    const playlist = { id: crypto.randomUUID(), name, trackIds: [] };
    if (await savePlaylist(playlist)) dispatch({ type: "ADD_PLAYLIST", playlist });
  };

  const handleRenamePlaylist = async (id, name) => {
    const playlist = library.playlists.find((p) => p.id === id);
    if (!playlist) return;
    const updated = { ...playlist, name };
    if (await savePlaylist(updated)) dispatch({ type: "UPDATE_PLAYLIST", playlist: updated });
  };

  const handleDeletePlaylist = async (id) => {
    await dbDeletePlaylist(id);
    dispatch({ type: "DELETE_PLAYLIST", id });
  };

  const handleAddTrackToPlaylist = async (playlistId, trackId) => {
    const playlist = library.playlists.find((p) => p.id === playlistId);
    if (!playlist || playlist.trackIds.includes(trackId)) return;
    const updated = { ...playlist, trackIds: [...playlist.trackIds, trackId] };
    if (await savePlaylist(updated)) dispatch({ type: "UPDATE_PLAYLIST", playlist: updated });
  };

  const handleRemoveTrackFromPlaylist = async (playlistId, trackId) => {
    const playlist = library.playlists.find((p) => p.id === playlistId);
    if (!playlist) return;
    const updated = { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) };
    if (await savePlaylist(updated)) dispatch({ type: "UPDATE_PLAYLIST", playlist: updated });
  };

  const handlePlayPlaylist = (playlistId) => {
    const playlist = library.playlists.find((p) => p.id === playlistId);
    if (!playlist) return;
    const trackIdSet = new Set(library.tracks.map((t) => t.id));
    const validIds = playlist.trackIds.filter((id) => trackIdSet.has(id));
    if (validIds.length === 0) return;
    shuffleQueue.setQueue(validIds, validIds[0]);
  };

  const saveAlbum = async (album) => {
    try {
      await putAlbum(album);
      return true;
    } catch (e) {
      setStatus({ msg: e.message, type: "err" });
      return false;
    }
  };

  const handleCreateAlbum = async (name, coverImageBlob) => {
    const album = { id: crypto.randomUUID(), name, coverImageBlob: coverImageBlob ?? null, trackIds: [] };
    if (await saveAlbum(album)) dispatch({ type: "ADD_ALBUM", album });
  };

  const handleDeleteAlbum = async (id) => {
    await dbDeleteAlbum(id);
    dispatch({ type: "DELETE_ALBUM", id });
  };

  // A track belongs to at most one album: reassigning pulls it out of its
  // previous album's trackIds before adding it to the new one.
  const handleAssignTrackToAlbum = async (albumId, trackId) => {
    const track = library.tracks.find((t) => t.id === trackId);
    const targetAlbum = library.albums.find((a) => a.id === albumId);
    if (!track || !targetAlbum || track.albumId === albumId) return;

    const previousAlbum = track.albumId ? library.albums.find((a) => a.id === track.albumId) : null;
    const updatedTrack = { ...track, albumId };
    const updatedTargetAlbum = { ...targetAlbum, trackIds: [...targetAlbum.trackIds, trackId] };
    const updatedPreviousAlbum = previousAlbum
      ? { ...previousAlbum, trackIds: previousAlbum.trackIds.filter((id) => id !== trackId) }
      : null;

    try {
      await putTrack(updatedTrack);
      await putAlbum(updatedTargetAlbum);
      if (updatedPreviousAlbum) await putAlbum(updatedPreviousAlbum);
    } catch (e) {
      setStatus({ msg: e.message, type: "err" });
      return;
    }

    dispatch({ type: "UPDATE_TRACK", track: updatedTrack });
    dispatch({ type: "UPDATE_ALBUM", album: updatedTargetAlbum });
    if (updatedPreviousAlbum) dispatch({ type: "UPDATE_ALBUM", album: updatedPreviousAlbum });
  };

  const handleRemoveTrackFromAlbum = async (trackId) => {
    const track = library.tracks.find((t) => t.id === trackId);
    if (!track || !track.albumId) return;
    const album = library.albums.find((a) => a.id === track.albumId);
    const updatedTrack = { ...track, albumId: null };
    const updatedAlbum = album ? { ...album, trackIds: album.trackIds.filter((id) => id !== trackId) } : null;

    try {
      await putTrack(updatedTrack);
      if (updatedAlbum) await putAlbum(updatedAlbum);
    } catch (e) {
      setStatus({ msg: e.message, type: "err" });
      return;
    }

    dispatch({ type: "UPDATE_TRACK", track: updatedTrack });
    if (updatedAlbum) dispatch({ type: "UPDATE_ALBUM", album: updatedAlbum });
  };

  const handlePlayAlbum = (albumId) => {
    const album = library.albums.find((a) => a.id === albumId);
    if (!album) return;
    const trackIdSet = new Set(library.tracks.map((t) => t.id));
    const validIds = album.trackIds.filter((id) => trackIdSet.has(id));
    if (validIds.length === 0) return;
    shuffleQueue.setQueue(validIds, validIds[0]);
  };

  return (
    <div className={styles.root}>
      <div className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.controlBtn} ${activeTab === tab.id ? styles.controlBtnActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <UploadButton existingTracks={library.tracks} onTrackAdded={handleTrackAdded} onError={(msg) => setStatus({ msg, type: "err" })} />
      </div>

      {status && <StatusBar msg={status.msg} type={status.type} />}
      {library.error && <StatusBar msg={library.error} type="err" />}

      <div className={styles.mainPane}>
        {library.loading ? (
          <p style={{ color: "var(--tk-text-dim)" }}>Loading library…</p>
        ) : activeTab === "library" ? (
          <TrackList
            tracks={library.tracks}
            currentTrackId={shuffleQueue.currentId}
            isPlaying={player.isPlaying}
            onPlay={handlePlayTrack}
            onDelete={handleDeleteTrack}
          />
        ) : activeTab === "playlists" ? (
          <PlaylistView
            playlists={library.playlists}
            tracks={library.tracks}
            currentTrackId={shuffleQueue.currentId}
            onCreate={handleCreatePlaylist}
            onRename={handleRenamePlaylist}
            onDelete={handleDeletePlaylist}
            onAddTrack={handleAddTrackToPlaylist}
            onRemoveTrack={handleRemoveTrackFromPlaylist}
            onPlay={handlePlayPlaylist}
          />
        ) : (
          <AlbumView
            albums={library.albums}
            tracks={library.tracks}
            currentTrackId={shuffleQueue.currentId}
            onCreate={handleCreateAlbum}
            onDelete={handleDeleteAlbum}
            onAssignTrack={handleAssignTrackToAlbum}
            onRemoveTrack={handleRemoveTrackFromAlbum}
            onPlay={handlePlayAlbum}
          />
        )}
      </div>

      <Visualizer audioRef={player.audioRef} isPlaying={player.isPlaying} />

      <PlayerControls
        currentTrack={currentTrack}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onNext={() => shuffleQueue.next({ repeatAll: repeatMode === "all" })}
        onPrevious={shuffleQueue.previous}
        shuffle={shuffleQueue.shuffle}
        onToggleShuffle={shuffleQueue.toggleShuffle}
        repeatMode={repeatMode}
        onCycleRepeat={handleCycleRepeat}
        volume={player.volume}
        onVolumeChange={player.setVolume}
      />
    </div>
  );
}
