import { openDB } from "idb";
import { storedMessage } from "./history.js";

// Local-only chat storage: this device's identity (keys + name), contacts,
// and message history. File bytes are never stored — only name/mime/size
// (history.js storedMessage).
//
// meta:     "identity" → { keys: CryptoKeyPair, pubKey, mac, name }, "settings" → {...}
// contacts: { mac, name, nickname, pubKey, unread, lastMessageAt, lastSeen, addedAt }
// messages: keyed [peer, id] — ids come from the sender, so scoping them to
//           the peer stops one device overwriting another's messages.

const DB_NAME = "p2p-chat-db";
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("contacts")) db.createObjectStore("contacts", { keyPath: "mac" });
        if (!db.objectStoreNames.contains("messages")) {
          const store = db.createObjectStore("messages", { keyPath: ["peer", "id"] });
          store.createIndex("byPeerTs", ["peer", "ts"]);
        }
      },
    });
    // A failed open (private mode, blocked storage) shouldn't be cached forever.
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

export async function loadIdentity() {
  return (await getDB()).get("meta", "identity");
}

export async function saveIdentity(identity) {
  await (await getDB()).put("meta", identity, "identity");
}

export async function getContacts() {
  return (await getDB()).getAll("contacts");
}

export async function getContact(mac) {
  return (await getDB()).get("contacts", mac);
}

export async function putContact(contact) {
  await (await getDB()).put("contacts", contact);
}

// Read-modify-write in one transaction so concurrent updates (unread++ from
// two messages arriving together) don't clobber each other.
export async function updateContact(mac, update) {
  const db = await getDB();
  const tx = db.transaction("contacts", "readwrite");
  const current = await tx.store.get(mac);
  const next = update(current);
  if (next) await tx.store.put(next);
  await tx.done;
  return next;
}

// Latest `limit` messages for a peer, oldest first.
export async function getMessages(peer, limit = 500) {
  const db = await getDB();
  const range = IDBKeyRange.bound([peer, -Infinity], [peer, Infinity]);
  const out = [];
  let cursor = await db.transaction("messages").store.index("byPeerTs").openCursor(range, "prev");
  while (cursor && out.length < limit) {
    out.push(cursor.value);
    cursor = await cursor.continue();
  }
  return out.reverse();
}

export async function getQueuedMessages(peer) {
  return (await getMessages(peer, Infinity)).filter(m => m.status === "queued");
}

export async function putMessage(msg) {
  await (await getDB()).put("messages", storedMessage(msg));
}

export async function updateMessage(peer, id, patch) {
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");
  const current = await tx.store.get([peer, id]);
  if (current) await tx.store.put({ ...current, ...patch });
  await tx.done;
}

export async function deleteMessage(peer, id) {
  await (await getDB()).delete("messages", [peer, id]);
}

async function deleteRange(tx, peer) {
  const range = IDBKeyRange.bound([peer, -Infinity], [peer, Infinity]);
  let cursor = await tx.objectStore("messages").index("byPeerTs").openCursor(range);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
}

export async function clearMessages(peer) {
  const db = await getDB();
  const tx = db.transaction(["messages", "contacts"], "readwrite");
  await deleteRange(tx, peer);
  const contact = await tx.objectStore("contacts").get(peer);
  if (contact) await tx.objectStore("contacts").put({ ...contact, unread: 0, lastMessageAt: 0 });
  await tx.done;
}

export async function deleteContactAndHistory(peer) {
  const db = await getDB();
  const tx = db.transaction(["messages", "contacts"], "readwrite");
  await deleteRange(tx, peer);
  await tx.objectStore("contacts").delete(peer);
  await tx.done;
}
