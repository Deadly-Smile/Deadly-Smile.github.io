// ─── The host's simulation ──────────────────────────────────────────────────
// The host runs the only real copy of every player's body. Guests send
// numbered commands (one per tick of their own clock: keys + view angles);
// the host applies them in order with the same stepPlayer() the guests
// predict with, and reports back the last one applied. The host's own
// player is stepped directly from its local input.
//
// A guest can't move faster by sending more commands: each player earns one
// command of budget per host tick (with a little slack for jitter), and
// commands beyond the budget wait.
// Pure: no PeerJS/DOM. Movement only; combat arrives with FPS-10.
import { createPlayer, stepPlayer, MAX_PITCH, CROUCH_HEIGHT } from "../engine/player.js";
import { BODY_HEIGHT } from "../engine/geometry.js";
import { STEP } from "../engine/loop.js";
import { MAX_PLAYERS } from "./protocol.js";

export const HOST_ID = 0;
const BUDGET_MAX = 8;        // commands a player may have saved up
const QUEUE_MAX = 60;        // commands kept waiting (1 s); older ones are dropped
const NAME_MAX = 16;

export const cleanName = (name) => String(name ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, NAME_MAX) || "Player";

export function createHostSim(map, hostName) {
  const spawns = [...map.teamSpawns.a, ...map.teamSpawns.b];
  const players = new Map(); // id → { id, name, body, queue, budget, lastSeq, queuedSeq }

  function add(name) {
    let id = 0;
    while (players.has(id)) id++;
    if (id >= MAX_PLAYERS) return null;
    const body = createPlayer(spawns[id % spawns.length]);
    players.set(id, { id, name: cleanName(name), body, queue: [], budget: 1, lastSeq: 0, queuedSeq: 0 });
    return id;
  }
  add(hostName);

  return {
    players,
    add,
    remove(id) {
      if (id !== HOST_ID) players.delete(id);
    },
    roster: () => [...players.values()].map(p => ({ id: p.id, name: p.name })),

    // Commands from a guest (already decoded). Repeats and stale ones are
    // ignored; they must arrive oldest first within a packet.
    receive(id, cmds) {
      const p = players.get(id);
      if (!p || id === HOST_ID) return;
      for (const c of cmds) {
        if (c.seq <= p.queuedSeq) continue;
        p.queuedSeq = c.seq;
        p.queue.push(c);
      }
      if (p.queue.length > QUEUE_MAX) p.queue.splice(0, p.queue.length - QUEUE_MAX);
    },

    // One host tick. `local` is the host player's own { input, yaw, pitch }.
    tick(local) {
      for (const p of players.values()) {
        if (p.id === HOST_ID) {
          apply(p.body, local, map.boxes);
          continue;
        }
        p.budget = Math.min(BUDGET_MAX, p.budget + 1);
        while (p.queue.length && p.budget >= 1) {
          const c = p.queue.shift();
          apply(p.body, c, map.boxes);
          p.lastSeq = c.seq;
          p.budget--;
        }
      }
    },

    // What player `id` is sent: its own exact state and everyone else.
    snapshotFor(id, tick, time) {
      const me = players.get(id);
      if (!me) return null;
      const others = [];
      for (const p of players.values()) {
        if (p.id !== id) others.push({ id: p.id, ...publicState(p.body) });
      }
      return { tick, time, ack: me.lastSeq, self: { ...publicState(me.body), vel: me.body.vel }, others };
    },
  };
}

function apply(body, { input, yaw, pitch }, boxes) {
  body.yaw = yaw;
  body.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
  stepPlayer(body, input, STEP, boxes);
}

const publicState = (b) => ({ pos: b.pos, yaw: b.yaw, pitch: b.pitch, onGround: b.onGround, crouched: b.crouched });

// Overwrite a body with authoritative state (used by guests' prediction).
export function setBody(body, s) {
  body.pos = [...s.pos];
  body.prev = [...s.pos];
  body.vel = [...s.vel];
  body.onGround = s.onGround;
  body.crouched = s.crouched;
  body.height = s.crouched ? CROUCH_HEIGHT : BODY_HEIGHT;
}
