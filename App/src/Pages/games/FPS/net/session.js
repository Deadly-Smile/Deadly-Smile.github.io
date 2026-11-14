// ─── A multiplayer session, from the game's point of view ───────────────────
// Host and guest sessions expose the same interface, so the game (netGame.js)
// doesn't care which one it is:
//
//   body, loadout             the local player's (predicted, for a guest)
//   step(cmd)                 one simulation tick → what the local weapon did
//                             ({ events, kick }, as stepWeapons returns)
//   self()                    { hp, dead, respawnIn }
//   others(nowMs)             everyone else, ready to draw
//   grenades()                grenades in flight: [[x, y, z]]
//   drain()                   what happened since last asked: hit, hurt,
//                             kill, boom, pickup, drops (see hostSim.js)
//   viewTime(nowMs)           the host-clock moment the others are drawn at
//   takeCorrection()          how far prediction was corrected since last
//                             asked ([dx,dy,dz]; guests only, else zeros)
//   roster / match            who's here (team, score, ping) and the match
//                             (state, team scores, time left, winner)
//   setTeam(t) / setPrimary(w)  ask to change sides / the next life's gun
//   sendChat(text, teamOnly)  a chat line; it comes back through drain()
//                             as { t: "chat", … } once the host relays it
//   mapId                     the map being played; it can change between
//                             matches (the host's setNextMap(id) / endNow())
//   status()                  ping, link health
//   close()
//
// The host runs the match (hostSim.js), sends each guest snapshots and
// forwards events; a guest predicts its own player (predict.js) and draws
// everyone else from interpolated snapshots (interp.js).
import { openRoom, joinRoom } from "./room.js";
import { createHostSim, cleanName, HOST_ID } from "./hostSim.js";
import { createPredictor } from "./predict.js";
import { createInterpolator } from "./interp.js";
import { encodeCommands, decodeCommands, encodeSnapshot, decodeSnapshot, snapshotWanted, SNAPSHOT_HZ } from "./protocol.js";
import { CROUCH_HEIGHT } from "../engine/player.js";
import { BODY_HEIGHT } from "../engine/geometry.js";
import { activeWeapon } from "../engine/weapons.js";
import { MAPS, getMap } from "../maps/index.js";

const TICKS_PER_SNAPSHOT = Math.round(60 / SNAPSHOT_HZ);
const PING_EVERY_MS = 2000;
const STALL_MS = 1500;     // no snapshot for this long: "host not responding"
const LOST_MS = 10000;     // …this long: give up
const ZERO = [0, 0, 0];

// `options`: the match settings (see DEFAULT_OPTIONS in hostSim.js).
export async function hostSession({ map, name, primary, options }) {
  const sim = createHostSim(map, cleanName(name), { hostPrimary: primary, options });
  const keys = new Map(); // player id → guest's PeerJS id
  const ids = new Map();  // …and back
  const started = performance.now();
  const me = sim.players.get(HOST_ID);
  let inbox = [];         // events for the local player
  let tick = 0;

  const room = await openRoom({
    onJoin(key, hello) {
      const id = sim.add(hello.name, hello.primary, hello.team);
      if (id === null) return null;
      keys.set(id, key);
      ids.set(key, id);
      const b = sim.players.get(id).body;
      return {
        t: "welcome", id, map: map.id, spawn: { pos: b.pos, yaw: b.yaw },
        players: sim.roster(), match: sim.matchState(), drops: sim.dropList(),
      };
    },
    onLeave(key) {
      sim.remove(ids.get(key));
      keys.delete(ids.get(key));
      ids.delete(key);
    },
    onEvent(key, msg) {
      const id = ids.get(key);
      if (msg.t === "ping") {
        room.sendEvent(key, { t: "pong", c: msg.c });
        sim.setPing(id, msg.rtt);
      } else if (msg.t === "team") sim.setTeam(id, msg.team);
      else if (msg.t === "primary") sim.setPrimary(id, msg.weapon);
      else if (msg.t === "chat") sim.chat(id, msg.text, msg.team === true);
    },
    onState(key, buf) {
      const cmds = decodeCommands(buf);
      if (cmds) sim.receive(ids.get(key), cmds);
    },
  });

  // Hand the tick's events to whoever they're for.
  function deliver() {
    if (sim.changed("roster")) sim.events.push({ to: null, msg: { t: "roster", players: sim.roster(), match: sim.matchState() } });
    if (sim.changed("drops")) sim.events.push({ to: null, msg: { t: "drops", list: sim.dropList() } });
    for (const { to, msg } of sim.events) {
      if (to === null) room.broadcast(msg);
      if (to === null || to === HOST_ID) inbox.push(msg);
      else room.sendEvent(keys.get(to), msg);
    }
    sim.events.length = 0;
  }

  return {
    role: "host",
    roomId: room.roomId,
    selfId: HOST_ID,
    get mapId() { return sim.map.id; },
    setNextMap: (id) => MAPS.some(m => m.id === id) && sim.setNextMap(getMap(id)),
    endNow: () => sim.endNow(),
    body: me.body,
    loadout: me.loadout,
    get roster() { return sim.roster(); },
    get match() { return sim.matchState(); },
    setTeam: (team) => sim.setTeam(HOST_ID, team),
    setPrimary: (weapon) => sim.setPrimary(HOST_ID, weapon),
    sendChat: (text, teamOnly) => sim.chat(HOST_ID, text, !!teamOnly),
    step(cmd) {
      const time = performance.now() - started;
      const out = sim.tick(cmd, time);
      deliver();
      if (++tick % TICKS_PER_SNAPSHOT === 0) {
        for (const [id, key] of keys) {
          const snap = sim.snapshotFor(id, tick);
          if (snap) room.sendState(key, encodeSnapshot(snap));
        }
      }
      return out;
    },
    self: () => ({ hp: me.health.hp, dead: me.health.dead, respawnIn: Math.max(0, me.respawnIn) }),
    // The host draws the real bodies (interpolated between ticks by the caller).
    others() {
      const out = [];
      for (const p of sim.players.values()) {
        if (p !== me) out.push({ ...p.body, id: p.id, dead: p.health.dead, weapon: activeWeapon(p.loadout).id, shots: p.shots });
      }
      return out;
    },
    grenades: () => sim.grenades().map(g => g.pos),
    drain() {
      const out = inbox;
      inbox = [];
      return out;
    },
    viewTime: () => performance.now() - started,
    takeCorrection: () => ZERO,
    status: () => ({ ping: 0, stalled: false }),
    close: () => room.close(),
  };
}

// onClosed(reason) when the host goes away or the link dies.
const NO_MATCH = { state: "playing", timeLeft: 0, scores: { a: 0, b: 0 }, winner: null, restartIn: 0, killLimit: 0 };

export async function joinSession({ roomId, name, primary, onClosed }) {
  const code = String(roomId).trim().toUpperCase();
  const interp = createInterpolator();
  let predictor = null;
  let boxes = null;        // the walls of the map being played…
  let mapId = null;
  let gen = null;          // …and its generation (see hostSim.js's mapGen)
  let roster = [];
  let match = NO_MATCH;
  let inbox = [];
  let latest = null;       // newest snapshot
  let ping = 0;
  let lastSnapshot = performance.now();
  let correction = [0, 0, 0];
  let closed = false;

  const link = await joinRoom(code, { name: cleanName(name), primary }, {
    onEvent(msg) {
      if (msg.t === "roster" && Array.isArray(msg.players)) {
        roster = msg.players;
        if (msg.match) setMatch(msg.match);
      } else if (msg.t === "pong") ping = Math.round(performance.now() - msg.c);
      else inbox.push(msg);
    },
    onState(buf) {
      const snap = decodeSnapshot(buf);
      if (!predictor || !boxes || !snapshotWanted(snap, gen, latest?.tick ?? null)) return;
      latest = snap;
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

  // The match as the host reports it; a new map generation means the map
  // changed: load its walls and forget where everyone was on the old one.
  function setMatch(m) {
    match = m;
    const g = m.mapGen ?? 0;
    if (g === gen) return;
    gen = g;
    mapId = getMap(m.mapId ?? mapId).id;
    boxes = getMap(mapId).boxes;
    interp.clear();
  }

  const { welcome } = link;
  roster = welcome.players ?? [];
  mapId = welcome.map;
  setMatch(welcome.match ?? NO_MATCH);
  if (Array.isArray(welcome.drops)) inbox.push({ t: "drops", list: welcome.drops });
  predictor = createPredictor(welcome.id, welcome.spawn, primary);
  const pinger = setInterval(() => {
    link.sendEvent({ t: "ping", c: performance.now(), rtt: ping });
    if (!closed && performance.now() - lastSnapshot > LOST_MS) {
      closed = true;
      clearInterval(pinger);
      link.close();
      onClosed("Lost the connection to the host.");
    }
  }, PING_EVERY_MS);

  return {
    role: "guest",
    roomId: code,
    selfId: welcome.id,
    get mapId() { return mapId; },
    body: predictor.body,
    loadout: predictor.loadout,
    get roster() { return roster; },
    get match() { return match; },
    setTeam: (team) => link.sendEvent({ t: "team", team }),
    setPrimary: (weapon) => link.sendEvent({ t: "primary", weapon }),
    sendChat: (text, teamOnly) => link.sendEvent({ t: "chat", text: String(text).slice(0, 1000), team: !!teamOnly }),
    step(cmd) {
      const out = predictor.step({ ...cmd, view: interp.renderTime(performance.now()) ?? 0 }, boxes);
      link.sendState(encodeCommands(out.packet));
      return out;
    },
    self: () => (latest ? { hp: latest.self.hp, dead: latest.self.dead, respawnIn: latest.self.respawnIn } : { hp: 100, dead: false, respawnIn: 0 }),
    others(nowMs) {
      const t = interp.renderTime(nowMs);
      if (t === null) return [];
      const out = [];
      for (const id of interp.ids(t)) {
        const s = interp.sample(id, t);
        if (s) out.push({ ...s, id, prev: s.pos, height: s.crouched ? CROUCH_HEIGHT : BODY_HEIGHT });
      }
      return out;
    },
    grenades: () => latest?.grenades ?? [],
    drain() {
      const out = inbox;
      inbox = [];
      return out;
    },
    viewTime: (nowMs) => interp.renderTime(nowMs) ?? 0,
    takeCorrection() {
      const c = correction;
      correction = [0, 0, 0];
      return c;
    },
    status: () => ({ ping, stalled: performance.now() - lastSnapshot > STALL_MS }),
    close() {
      closed = true;
      clearInterval(pinger);
      link.close();
    },
  };
}
