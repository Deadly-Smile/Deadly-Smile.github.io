// Pure chat data helpers — message shape, the peer list, grouping. No React,
// no IndexedDB, so chatLogic.test.js can run them under plain Node.
//
// Message: { peer, id, from: "me"|"them", type: "text"|"file", text?,
//            name?, mime?, size?, ts (ms), status: "queued"|"sent"|"delivered" }
// File bytes are never persisted — only name/mime/size. Received/sent blobs
// live in a per-session cache in Chat.jsx.

import { formatMac, isMac, cleanName } from "./identity.js";

export const TEXT_MAX = 10000;

export function storedMessage(msg) {
  const out = { peer: msg.peer, id: msg.id, from: msg.from, type: msg.type, ts: msg.ts, status: msg.status };
  if (msg.type === "text") out.text = msg.text;
  else { out.name = msg.name; out.mime = msg.mime; out.size = msg.size; }
  return out;
}

// Validates a peer's "text" payload; null if malformed. Ids come from the
// sender, so they're only trusted as opaque short strings.
export function incomingText(data, peer, now) {
  if (typeof data?.id !== "string" || data.id.length > 64) return null;
  if (typeof data.text !== "string" || !data.text) return null;
  return { peer, id: data.id, from: "them", type: "text", text: data.text.slice(0, TEXT_MAX), ts: now, status: "delivered" };
}

export function displayName(contact, mac) {
  return contact?.nickname || contact?.name || `Device ${formatMac(mac).slice(-5)}`;
}

// One row per device worth showing: saved contacts plus anything currently
// reachable (same network per the presence server, online contacts, or an
// open verified link). Online first, then unread, then most recent chat.
export function buildPeerList({ myMac, contacts, nearby = [], online = [], links = {} }) {
  const rows = new Map();
  const row = (mac) => {
    if (!rows.has(mac)) rows.set(mac, { mac, contact: null, presenceName: "", nearby: false, online: false, link: null });
    return rows.get(mac);
  };
  for (const c of contacts) if (isMac(c.mac)) row(c.mac).contact = c;
  for (const p of nearby) {
    if (!isMac(p.mac) || p.mac === myMac) continue;
    const r = row(p.mac);
    r.nearby = r.online = true;
    r.presenceName = cleanName(p.name);
  }
  for (const p of online) {
    if (!isMac(p.mac) || p.mac === myMac) continue;
    const r = row(p.mac);
    r.online = true;
    r.presenceName ||= cleanName(p.name);
  }
  for (const [mac, state] of Object.entries(links)) {
    if (!isMac(mac) || mac === myMac) continue;
    const r = row(mac);
    r.link = state;
    if (state === "ready") r.online = true;
  }

  return [...rows.values()]
    .map(r => ({
      ...r,
      label: r.contact ? displayName(r.contact, r.mac) : (r.presenceName || displayName(null, r.mac)),
      unread: r.contact?.unread ?? 0,
      lastMessageAt: r.contact?.lastMessageAt ?? 0,
    }))
    .sort((a, b) =>
      (b.online - a.online) ||
      ((b.unread > 0) - (a.unread > 0)) ||
      (b.lastMessageAt - a.lastMessageAt) ||
      a.label.localeCompare(b.label));
}

// Inserts or replaces by id, keeping ts order (history loads and live
// messages can interleave).
export function upsertMessage(list, msg) {
  const i = list.findIndex(m => m.id === msg.id);
  if (i >= 0) {
    const next = list.slice();
    next[i] = { ...list[i], ...msg };
    return next;
  }
  const next = [...list, msg];
  if (list.length && list[list.length - 1].ts > msg.ts) next.sort((a, b) => a.ts - b.ts);
  return next;
}

export function groupMessages(messages) {
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    return {
      msg,
      showAvatar: !prev || prev.from !== msg.from,
      showDate: !prev || new Date(prev.ts).toDateString() !== new Date(msg.ts).toDateString(),
    };
  });
}
