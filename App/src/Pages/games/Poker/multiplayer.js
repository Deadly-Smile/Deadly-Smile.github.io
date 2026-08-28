// ─── PeerJS room networking for multiplayer poker ────────────────────────────
// Host-authoritative: the host runs the real engine.js state; a guest is a
// thin terminal that renders whatever the host sends and forwards its own
// action intents back. See PLAN.md's "Multiplayer" section for the protocol
// and — importantly — why state is never broadcast raw (hole-card privacy).
import Peer from "peerjs";
import { getIceServers, generateRoomId } from "../../tools/tk-shared.jsx";

const MAX_GUEST_SEATS = 5; // seats 1..5 — seat 0 is always the host's own

// Strips anything a guest shouldn't be able to read straight off the wire:
// the undealt deck (no one but the host ever needs it) and every other seat's
// hole cards, unless that seat is genuinely revealed at showdown. This is the
// one place per-recipient personalization matters — seat 2's payload must not
// be seat 3's payload.
export function redactStateForSeat(state, seatId) {
  const showdownReveal = state.street === "handOver" && state.result && !state.result.unopposed;
  return {
    ...state,
    deck: [],
    players: state.players.map(p => {
      const visible = p.id === seatId || (showdownReveal && !p.folded);
      return visible ? p : { ...p, holeCards: p.holeCards.map(() => ({})) };
    }),
  };
}

// Creates the room. Resolves once the PeerJS peer is open and ready to accept
// connections; `handlers` are wired for the room's whole lifetime.
export async function hostRoom({ onJoin, onAction, onLeave, onError }) {
  const iceServers = await getIceServers();
  const peer = new Peer(generateRoomId(), { config: { iceServers } });

  return new Promise((resolve, reject) => {
    let settled = false;
    peer.on("open", (roomId) => {
      settled = true;
      peer.on("connection", (conn) => {
        conn.on("data", (msg) => {
          if (msg?.type === "hello") onJoin(conn, msg.name);
          else onAction(conn, msg);
        });
        conn.on("close", () => onLeave(conn));
        conn.on("error", () => onLeave(conn));
      });
      resolve({ peer, roomId });
    });
    peer.on("error", (e) => { if (!settled) reject(e); else onError?.(e); });
  });
}

// Joins an existing room by code. Resolves once the data connection is open;
// the caller supplies its display name, which the host echoes back attached
// to whichever seat it assigns.
export async function joinRoomAsClient(roomId, name, { onMessage, onClose, onError }) {
  const iceServers = await getIceServers();
  const peer = new Peer(undefined, { config: { iceServers } });

  return new Promise((resolve, reject) => {
    let settled = false;
    peer.on("open", () => {
      const conn = peer.connect(roomId, { reliable: true });
      conn.on("open", () => {
        settled = true;
        conn.send({ type: "hello", name });
        resolve({ peer, conn });
      });
      conn.on("data", onMessage);
      conn.on("close", () => onClose?.());
      conn.on("error", (e) => { if (!settled) reject(e); else onError?.(e); });
    });
    peer.on("error", (e) => { if (!settled) reject(e); });
  });
}

// Sends the host's current state to every connected guest, each redacted for
// that specific seat.
export function broadcastState(connections, state) {
  for (const [seatId, conn] of connections) {
    if (conn.open) conn.send({ type: "state", state: redactStateForSeat(state, seatId) });
  }
}

export function nextOpenSeat(connections) {
  for (let seat = 1; seat <= MAX_GUEST_SEATS; seat++) {
    if (!connections.has(seat)) return seat;
  }
  return -1;
}
