import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { navigate, useSearchParams } from "../../../Utils/router";
import { useKeepAliveActive, useKeepAliveRelease } from "../../../Utils/KeepAlive";
import { usePersistentState } from "../../../Utils/usePersistentState";
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
import { useMediaSession } from "./hooks/useMediaSession";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { SEEK_STEP_SECONDS, VOLUME_STEP } from "./shortcuts";
import { closeAudioGraph } from "./hooks/useVisualizer";
import UploadButton from "./components/UploadButton";
import TrackList from "./components/TrackList";
import PlaylistView from "./components/PlaylistView";
import AlbumView from "./components/AlbumView";
import PlayerControls from "./components/PlayerControls";
import Visualizer from "./components/Visualizer";
import SyncPanel from "./components/SyncPanel";
import MiniPlayer from "./components/MiniPlayer";
import styles from "./MusicPlayer.module.css";

const REPEAT_CYCLE = ["off", "all", "one"];
// A media key can reach us twice — as a Media Session action and as a
// keydown — so the same kind of media action within this window is dropped.
const MEDIA_DEDUPE_MS = 500;
const MEDIA_GROUP = { toggle: "playpause", play: "playpause", pause: "playpause", next: "next", previous: "previous" };
const TABS = [
  { id: "library", label: "Library" },
  { id: "playlists", label: "Playlists" },
  { id: "albums", label: "Albums" },
  { id: "sync", label: "Sync" },
];

export default function MusicPlayer() {
  // Kept alive at the app root (Toolz registry `keepAlive`): while another
  // page is showing, playback continues and a MiniPlayer stands in for the UI.
  const onScreen = useKeepAliveActive();
  const releaseInstance = useKeepAliveRelease();
  const [searchParams] = useSearchParams();
  // Only honour ?sync= on our own page — while hidden, the URL is someone else's.
  const autoJoinRoomId = (onScreen && searchParams.get("sync")?.toUpperCase()) || null;
  const [library, dispatch] = useReducer(libraryReducer, initialLibraryState);
  // Volume/shuffle/repeat/last track persist via ./storage; this is just the open tab.
  const [storedTab, setActiveTab] = usePersistentState("tool:music_player:tab", autoJoinRoomId ? "sync" : "library");
  const activeTab = TABS.some((t) => t.id === storedTab) ? storedTab : "library";
  // A ?sync= invite link always lands on the Sync tab, whatever was open last (layout effect: applied before first paint, no flash).
  useLayoutEffect(() => {
    if (autoJoinRoomId) setActiveTab("sync");
  }, [autoJoinRoomId, setActiveTab]);
  const [repeatMode, setRepeatMode] = useState(() => getSettings().repeatMode);
  const [status, setStatus] = useState(null);

  const shuffleQueue = useShuffleQueue();
  const currentTrack = library.tracks.find((t) => t.id === shuffleQueue.currentId) ?? null;

  // useAudioPlayer keeps onNaturalEnd in a ref, so it can reach goNext
  // (defined after the player exists) through this one.
  const goNextRef = useRef(null);
  const handleNaturalEnd = useCallback(() => goNextRef.current?.(), []);

  const player = useAudioPlayer(currentTrack, { repeatMode, onNaturalEnd: handleNaturalEnd });

  const goNext = () => {
    const result = shuffleQueue.next({ repeatAll: repeatMode === "all" });
    if (!result) return; // swallowed by the double-press guard
    if (result.ended) {
      player.stopAtEnd({ trackChanges: result.id !== currentTrack?.id });
    } else if (result.id === currentTrack?.id) {
      // Repeat-all over a one-track queue: same id, so no track switch fires.
      player.seek(0);
      player.play();
    }
  };
  goNextRef.current = goNext;

  const lastMediaRef = useRef({ group: null, at: 0 });
  const unmutedVolumeRef = useRef(null);
  const performAction = (action, { mediaKey = false } = {}) => {
    if (mediaKey) {
      const group = MEDIA_GROUP[action];
      const now = performance.now();
      const last = lastMediaRef.current;
      if (group && last.group === group && now - last.at < MEDIA_DEDUPE_MS) return;
      lastMediaRef.current = { group, at: now };
    }
    const clampVolume = (v) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
    switch (action) {
      case "toggle": player.togglePlay(); break;
      case "play": player.play(); break;
      case "pause": player.pause(); break;
      case "next": goNext(); break;
      case "previous": shuffleQueue.previous(); break;
      case "seekBack": player.seek(Math.max(0, player.getCurrentTime() - SEEK_STEP_SECONDS)); break;
      case "seekForward":
        if (player.duration) player.seek(Math.min(player.duration, player.getCurrentTime() + SEEK_STEP_SECONDS));
        break;
      case "volumeUp": player.setVolume(clampVolume(player.volume + VOLUME_STEP)); break;
      case "volumeDown": player.setVolume(clampVolume(player.volume - VOLUME_STEP)); break;
      case "mute":
        if (player.volume > 0) {
          unmutedVolumeRef.current = player.volume;
          player.setVolume(0);
        } else {
          player.setVolume(unmutedVolumeRef.current || 0.5);
        }
        break;
    }
  };

  // Lock screen / notification controls (and keeps Android from freezing the tab).
  useMediaSession({
    track: currentTrack,
    coverBlob: library.albums.find((a) => a.id === currentTrack?.albumId)?.coverImageBlob ?? null,
    isPlaying: player.isPlaying,
    audioRef: player.audioRef,
    getCurrentTime: player.getCurrentTime,
    duration: player.duration,
    onPlay: () => performAction("play", { mediaKey: true }),
    onPause: () => performAction("pause", { mediaKey: true }),
    onNext: () => performAction("next", { mediaKey: true }),
    onPrevious: () => performAction("previous", { mediaKey: true }),
    onSeek: player.seek,
  });

  // Space/K, J/L, N/P, M, ↑/↓ on screen; media keys and Alt+Shift+P/N/B always.
  useKeyboardShortcuts(onScreen, performAction);

  const reloadLibrary = useCallback(() => {
    return Promise.all([getAllTracks(), getAllAlbums(), getAllPlaylists()])
      .then(([tracks, albums, playlists]) => dispatch({ type: "LOAD_SUCCESS", tracks, albums, playlists }))
      .catch((e) => dispatch({ type: "LOAD_ERROR", error: e.message }));
  }, []);

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
        ) : activeTab === "albums" ? (
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
        ) : (
          <SyncPanel onSynced={reloadLibrary} autoJoinRoomId={autoJoinRoomId} />
        )}
      </div>

      <Visualizer audioRef={player.audioRef} isPlaying={player.isPlaying} visible={onScreen} />

      <PlayerControls
        currentTrack={currentTrack}
        isPlaying={player.isPlaying}
        audioRef={player.audioRef}
        duration={player.duration}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onNext={goNext}
        onPrevious={shuffleQueue.previous}
        shuffle={shuffleQueue.shuffle}
        onToggleShuffle={shuffleQueue.toggleShuffle}
        repeatMode={repeatMode}
        onCycleRepeat={handleCycleRepeat}
        volume={player.volume}
        onVolumeChange={player.setVolume}
      />

      {!onScreen && currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={player.isPlaying}
          onTogglePlay={player.togglePlay}
          onNext={goNext}
          onPrevious={shuffleQueue.previous}
          onOpen={() => navigate("/toolz/music_player")}
          // Unmounting the instance pauses, saves position and closes the audio graph.
          onClose={releaseInstance}
        />
      )}
    </div>
  );
}
