// ─── A multiplayer session, from the game's point of view ───────────────────
// Host and guest sessions expose the same interface, so the game (netGame.js)
// doesn't care which one it is:
//
//   body                      the local player's body (move it by step())
//   step(input, yaw, pitch)   one simulation tick
//   others(nowMs)             everyone else, ready to draw
//   takeCorrection()          how far prediction was corrected since last
//                             asked ([dx,dy,dz]; guests only, else zeros)
//   roster / status()         who's here; ping and link health
//   close()
//
// The host runs the simulation (hostSim.js) and sends each guest snapshots;
// a guest predicts its own movement (predict.js) and draws everyone else
// from interpolated snapshots (interp.js). Movement only for now; combat is
// FPS-10.
import { openRoom, joinRoom } from "./room.js";
import { createHostSim, cleanName, HOST_ID } from "./hostSim.js";
import { createPredictor } from "./predict.js";
import { createInterpolator } from "./interp.js";
import { encodeCommands, decodeCommands, encodeSnapshot, decodeSnapshot, SNAPSHOT_HZ } from "./protocol.js";
import { CROUCH_HEIGHT } from "../engine/player.js";
import { BODY_HEIGHT } from "../engine/geometry.js";

const TICKS_PER_SNAPSHOT = Math.round(60 / SNAPSHOT_HZ);
const PING_EVERY_MS = 2000;
const STALL_MS = 1500;     // no snapshot for this long: "host not responding"
const LOST_MS = 10000;     // …this long: give up
const ZERO = [0, 0, 0];

// onRoster(list) whenever players join or leave.
export async function hostSession({ map, name, onRoster }) {
  const sim = createHostSim(map, cleanName(name));
  const ids = new Map(); // guest's PeerJS id → player id
  const started = performance.now();
  let tick = 0;

  const announce = () => {
    room.broadcast({ t: "roster", players: sim.roster() });
    onRoster(sim.roster());
  };

  const room = await openRoom({
    onJoin(key, guestName) {
      const id = sim.add(guestName);
      if (id === null) return null;
      ids.set(key, id);
      // After this handler returns the welcome is sent; then tell the rest.
      setTimeout(announce, 0);
      return { t: "welcome", id, map: map.id, spawn: { pos: sim.players.get(id).body.pos, yaw: sim.players.get(id).body.yaw }, players: sim.roster() };
    },
    onLeave(key) {
      sim.remove(ids.get(key));
      ids.delete(key);
      announce();
    },
    onEvent(key, msg) {
      if (msg.t === "ping") room.sendEvent(key, { t: "pong", c: msg.c });
    },
    onState(key, buf) {
      const cmds = decodeCommands(buf);
      if (cmds) sim.receive(ids.get(key), cmds);
    },
  });

  return {
    role: "host",
    roomId: room.roomId,
    selfId: HOST_ID,
    mapId: map.id,
    body: sim.players.get(HOST_ID).body,
    get roster() { return sim.roster(); },
    step(input, yaw, pitch) {
      sim.tick({ input, yaw, pitch });
      if (++tick % TICKS_PER_SNAPSHOT) return;
      const time = performance.now() - started;
      for (const [key, id] of ids) {
        const snap = sim.snapshotFor(id, tick, time);
        if (snap) room.sendState(key, encodeSnapshot(snap));
      }
    },
    // The host draws the real bodies (interpolated between ticks by the caller).
    others() {
      const out = [];
      for (const p of sim.players.values()) {
        if (p.id !== HOST_ID) out.push({ id: p.id, live: true, ...p.body });
      }
      return out;
    },
    takeCorrection: () => ZERO,
    status: () => ({ ping: 0, stalled: false, lost: false }),
    close: () => room.close(),
  };
}

// onRoster(list); onClosed(reason) when the host goes away or the link dies.
export async function joinSession({ roomId, name, onRoster, onClosed }) {
  const interp = createInterpolator();
  let predictor = null;
  let boxes = null;
  let roster = [];
  let ping = 0;
  let lastSnapshot = performance.now();
  let newestTick = 0;
  let correction = [0, 0, 0];
  let closed = false;

  const link = await joinRoom(String(roomId).trim().toUpperCase(), cleanName(name), {
    onEvent(msg) {
      if (msg.t === "roster" && Array.isArray(msg.players)) {
        roster = msg.players;
        onRoster(roster);
      } else if (msg.t === "pong") {
        ping = Math.round(performance.now() - msg.c);
      }
    },
    onState(buf) {
      const snap = decodeSnapshot(buf);
      // Unordered channel: an older snapshot can arrive after a newer one.
      if (!snap || !predictor || snap.tick <= newestTick) return;
      newestTick = snap.tick;
      const now = performance.now();
      lastSnapshot = now;
      interp.push(snap.time, snap.others, now);
      const moved = predictor.reconcile(snap.self, snap.ack, boxes);
      for (let i = 0; i < 3; i++) correction[i] += moved[i];
    },
    onClose() {
      if (closed) return;
      closed = true;
      clearInterval(pinger);
      onClosed("The host left the game.");
    },
  });

  const { welcome } = link;
  roster = welcome.players ?? [];
  predictor = createPredictor(welcome.spawn);
  const pinger = setInterval(() => {
    link.sendEvent({ t: "ping", c: performance.now() });
    if (!closed && performance.now() - lastSnapshot > LOST_MS) {
      closed = true;
      clearInterval(pinger);
      link.close();
      onClosed("Lost the connection to the host.");
    }
  }, PING_EVERY_MS);

  return {
    role: "guest",
    roomId: String(roomId).trim().toUpperCase(),
    selfId: welcome.id,
    mapId: welcome.map,
    body: predictor.body,
    get roster() { return roster; },
    // The map's boxes, once the game has loaded the map the host chose.
    setBoxes(b) { boxes = b; },
    step(input, yaw, pitch) {
      if (!boxes) return;
      link.sendState(encodeCommands(predictor.step(input, yaw, pitch, boxes)));
    },
    others(nowMs) {
      const t = interp.renderTime(nowMs);
      if (t === null) return [];
      const out = [];
      for (const id of interp.ids(t)) {
        const s = interp.sample(id, t);
        if (s) out.push({ id, live: false, ...s, prev: s.pos, height: s.crouched ? CROUCH_HEIGHT : BODY_HEIGHT });
      }
      return out;
    },
    takeCorrection() {
      const c = correction;
      correction = [0, 0, 0];
      return c;
    },
    status: () => ({ ping, stalled: performance.now() - lastSnapshot > STALL_MS, lost: closed }),
    close() {
      closed = true;
      clearInterval(pinger);
      link.close();
    },
  };
}
