import { openDB } from "idb";

// Local cache of the Supabase bank. The content is read-only here and only
// ever written by sync; personal progress lives in localStorage (progress.js).

const DB_NAME = "question-bank-db";
// v3: the bank moved to Supabase. v1/v2 held locally-authored questions with
// local autoincrement ids that don't correspond to Supabase ids, so every old
// store is dropped and the cache is rebuilt by the first sync.
const DB_VERSION = 3;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 3) {
          for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
        }
        if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
        if (!db.objectStoreNames.contains("questions")) db.createObjectStore("questions", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

function normalizeDbError(e) {
  if (e?.name === "QuotaExceededError" || e?.code === 22) {
    return new Error("Storage is full — your browser ran out of local space. Free up some disk space and sync again.");
  }
  return e;
}

// meta: { cursors: { categories, questions }, lastSyncedAt }
export async function loadCache() {
  const db = await getDB();
  const [categories, questions, cursors, lastSyncedAt] = await Promise.all([
    db.getAll("categories"),
    db.getAll("questions"),
    db.get("meta", "cursors"),
    db.get("meta", "lastSyncedAt"),
  ]);
  return { categories, questions, meta: { cursors: cursors ?? {}, lastSyncedAt: lastSyncedAt ?? null } };
}

// plans: { categories: {upserts, deletes}, questions: {upserts, deletes} } —
// applied in one transaction so a failed sync never leaves a half-updated cache.
export async function applySync(plans, meta) {
  const db = await getDB();
  try {
    const tx = db.transaction(["categories", "questions", "meta"], "readwrite");
    const ops = [];
    for (const store of ["categories", "questions"]) {
      const s = tx.objectStore(store);
      for (const row of plans[store].upserts) ops.push(s.put(row));
      for (const id of plans[store].deletes) ops.push(s.delete(id));
    }
    ops.push(tx.objectStore("meta").put(meta.cursors, "cursors"));
    ops.push(tx.objectStore("meta").put(meta.lastSyncedAt, "lastSyncedAt"));
    await Promise.all([...ops, tx.done]);
  } catch (e) {
    throw normalizeDbError(e);
  }
}
