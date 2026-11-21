import { createIdbStore } from "../../../../Utils/idbStore";

const idb = createIdbStore("music-player-db", 1, ["tracks", "albums", "playlists"]);
export const tracksStore = idb.store("tracks");
const albums = idb.store("albums");
const playlists = idb.store("playlists");

export const getAllTracks = tracksStore.getAll;
export const getTrack = tracksStore.get;
export const putTrack = tracksStore.put;
export const deleteTrack = tracksStore.del;
// Pre-sync-feature tracks predate the `hash` field — backfilled in place once.
export const ensureTrackHash = tracksStore.ensureHash;

export const getAllAlbums = albums.getAll;
export const getAlbum = albums.get;
export const putAlbum = albums.put;
export const deleteAlbum = albums.del;

export const getAllPlaylists = playlists.getAll;
export const getPlaylist = playlists.get;
export const putPlaylist = playlists.put;
export const deletePlaylist = playlists.del;
