import { openDB } from "idb";

const DB_NAME = "music-player-db";
const DB_VERSION = 1;
const STORES = ["tracks", "albums", "playlists"];

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id" });
          }
        }
      },
    });
  }
  return dbPromise;
}

function normalizeDbError(e) {
  if (e?.name === "QuotaExceededError" || e?.code === 22) {
    const err = new Error(
      "Storage is full — your browser ran out of local space. Delete some tracks/albums or free up disk space, then try again."
    );
    err.isQuotaExceeded = true;
    return err;
  }
  return e;
}

async function getAll(storeName) {
  try {
    const db = await getDB();
    return await db.getAll(storeName);
  } catch (e) {
    console.error(`Error reading ${storeName}:`, e);
    return [];
  }
}

async function get(storeName, id) {
  try {
    const db = await getDB();
    return await db.get(storeName, id);
  } catch (e) {
    console.error(`Error reading ${storeName} ${id}:`, e);
    return null;
  }
}

async function put(storeName, record) {
  const db = await getDB();
  try {
    await db.put(storeName, record);
    return record;
  } catch (e) {
    throw normalizeDbError(e);
  }
}

async function del(storeName, id) {
  try {
    const db = await getDB();
    await db.delete(storeName, id);
    return true;
  } catch (e) {
    console.error(`Error deleting ${storeName} ${id}:`, e);
    return false;
  }
}

export const getAllTracks = () => getAll("tracks");
export const getTrack = (id) => get("tracks", id);
export const putTrack = (track) => put("tracks", track);
export const deleteTrack = (id) => del("tracks", id);

export const getAllAlbums = () => getAll("albums");
export const getAlbum = (id) => get("albums", id);
export const putAlbum = (album) => put("albums", album);
export const deleteAlbum = (id) => del("albums", id);

export const getAllPlaylists = () => getAll("playlists");
export const getPlaylist = (id) => get("playlists", id);
export const putPlaylist = (playlist) => put("playlists", playlist);
export const deletePlaylist = (id) => del("playlists", id);
