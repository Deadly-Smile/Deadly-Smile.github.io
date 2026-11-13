// ─── PeerJS room: one host, up to 7 guests ──────────────────────────────────
// A star around the host, like Poker's rooms: the room code is the host's
// PeerJS id. Each guest opens two data channels to the host:
//
//   events  reliable, ordered, JSON     joining, leaving, the roster, pings
//   state   unordered, raw binary       commands up, snapshots down
//
// PeerJS can't open a truly lossy channel (it never sets maxRetransmits), so
// "state" is unordered rather than unreliable: a late packet still arrives,
// but it never holds newer ones back, which is what matters here.
// This file only moves bytes; what they mean is session.js's business.
import Peer from "peerjs";
import { getIceServers, generateRoomId } from "../../../tools/tk-shared.jsx";

const JOIN_TIMEOUT_MS = 15000;
const CH_EVENTS = "events";
const CH_STATE = "state";

// handlers: onJoin(key, hello) → welcome message object, or null to refuse
// (room full); onLeave(key); onEvent(key, msg); onState(key, buffer);
// onError(err). `key` is the guest's PeerJS id.
export async function openRoom(handlers) {
  const iceServers = await getIceServers();
  const peer = new Peer(generateRoomId(), { config: { iceServers } });
  const links = new Map(); // key → { events, state }

  const drop = (key) => {
    const link = links.get(key);
    if (!link) return;
    links.delete(key);
    link.events?.close();
    link.state?.close();
    handlers.onLeave(key);
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    peer.on("open", (roomId) => {
      settled = true;
      peer.on("connection", (conn) => {
        const key = conn.peer;
        if (conn.metadata?.ch === CH_STATE) {
          conn.on("open", () => {
            const link = links.get(key);
            if (link) link.state = conn;
            else conn.close();
          });
          conn.on("data", (buf) => { if (links.has(key)) handlers.onState(key, buf); });
          return;
        }
        conn.on("open", () => {
          const welcome = handlers.onJoin(key, conn.metadata ?? {});
          if (!welcome) {
            conn.send({ t: "full" });
            setTimeout(() => conn.close(), 500);
            return;
          }
          links.set(key, { events: conn, state: null });
          conn.send(welcome);
        });
        conn.on("data", (msg) => { if (links.has(key) && msg && typeof msg === "object") handlers.onEvent(key, msg); });
        conn.on("close", () => drop(key));
        conn.on("error", () => drop(key));
      });
      resolve({
        roomId,
        sendEvent(key, msg) {
          const c = links.get(key)?.events;
          if (c?.open) c.send(msg);
        },
        broadcast(msg) {
          for (const { events } of links.values()) if (events?.open) events.send(msg);
        },
        sendState(key, buf) {
          const c = links.get(key)?.state;
          if (c?.open) c.send(buf);
        },
        close() {
          for (const key of [...links.keys()]) drop(key);
          peer.destroy();
        },
      });
    });
    peer.on("error", (e) => { if (!settled) reject(e); else handlers.onError?.(e); });
  });
}

// Resolves with the host's welcome message and the link once joined; rejects
// with a readable Error (room not found, full, timed out). `hello` is what
// the guest tells the host about itself ({ name, primary }).
// handlers: onEvent(msg), onState(buffer), onClose().
export async function joinRoom(roomId, hello, handlers) {
  const iceServers = await getIceServers();
  const peer = new Peer(undefined, { config: { iceServers } });

  return new Promise((resolve, reject) => {
    let joined = false;
    let done = false;
    const fail = (message) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      peer.destroy();
      if (joined) handlers.onClose();
      else reject(new Error(message));
    };
    const timer = setTimeout(() => fail("Couldn't reach the room (timed out)."), JOIN_TIMEOUT_MS);

    peer.on("error", (e) => fail(e?.type === "peer-unavailable" ? "Room not found." : "Connection failed."));
    peer.on("open", () => {
      const events = peer.connect(roomId, { reliable: true, serialization: "json", metadata: { ...hello, ch: CH_EVENTS } });
      let state = null;
      events.on("data", (msg) => {
        if (!msg || typeof msg !== "object") return;
        if (msg.t === "full") return fail("That room is full.");
        if (msg.t !== "welcome" || joined) return handlers.onEvent(msg);
        joined = true;
        clearTimeout(timer);
        state = peer.connect(roomId, { reliable: false, serialization: "raw", metadata: { ch: CH_STATE } });
        state.on("data", (buf) => handlers.onState(buf));
        resolve({
          welcome: msg,
          sendEvent: (m) => { if (events.open) events.send(m); },
          sendState: (buf) => { if (state.open) state.send(buf); },
          close: () => { done = true; peer.destroy(); },
        });
      });
      events.on("close", () => fail("The host closed the room."));
      events.on("error", () => fail("Connection failed."));
    });
  });
}
