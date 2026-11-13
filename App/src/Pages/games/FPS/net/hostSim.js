// ─── The host's simulation ──────────────────────────────────────────────────
// The host runs the only real copy of the match: every player's body,
// weapons and health, the grenades in flight and the drops on the ground.
//
// Guests send numbered commands (one per tick of their own clock: keys,
// weapon buttons, view angles); the host applies them in order with the same
// runCommand() the guests predict with, and reports back the last one
// applied. Nobody can claim a hit: shots, stabs and throws come out of the
// host's own weapon simulation of those inputs, so fire rate, ammo and
// reloads are enforced by construction.
//
// Lag compensation: a guest sees everyone else slightly in the past. Each
// command says which moment that was, and the host checks the shot against
// where the other players were then (up to REWIND_MAX_MS back).
//
// A guest can't act faster by sending more commands: each player earns one
// command of budget per host tick (with a little slack for jitter).
// Pure: no PeerJS/DOM. What should be told to whom is queued in `events`.
import { createPlayer, eyeHeight } from "../engine/player.js";
import { createLoadout, activeWeapon, WEAPONS } from "../engine/weapons.js";
import {
  createHealth, applyDamage, stepHealth, revive, raycastActors, shotDamage, meleeDamage, explosionDamage,
} from "../engine/damage.js";
import { raycastWorld } from "../engine/geometry.js";
import { createGrenade, stepGrenade } from "../engine/projectile.js";
import { rollDrops, stepDrops, nearDrop, takeDrop, swapPrimary } from "../engine/pickups.js";
import { STEP } from "../engine/loop.js";
import { MAX_PLAYERS } from "./protocol.js";
import { runCommand, direction, loadoutState } from "./command.js";

export const HOST_ID = 0;
export const RESPAWN_DELAY = 3;      // s dead before respawning
export const SPAWN_PROTECTION = 2;   // s after (re)spawning that damage is ignored
export const REWIND_MAX_MS = 400;    // furthest back a shot is checked
const HISTORY_MS = 600;
const BUDGET_MAX = 8;        // commands a player may have saved up
const QUEUE_MAX = 60;        // commands kept waiting (1 s); older ones are dropped
const NAME_MAX = 16;
const THROW_LIFT = 0.18;     // grenades leave the hand a little above the aim line

export const cleanName = (name) => String(name ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, NAME_MAX) || "Player";

export function createHostSim(map, hostName, { hostPrimary, rand = Math.random } = {}) {
  const spawns = [...map.teamSpawns.a, ...map.teamSpawns.b, ...map.playerSpawns];
  const players = new Map();
  const events = [];   // { to: player id, or null for everyone; msg }
  let grenades = [];   // { ...grenade, owner }
  let drops = [];
  let now = 0;         // host clock (ms) of the tick being simulated
  let hostSeq = 0;
  let dirty = { roster: false, drops: false };

  const tell = (to, msg) => events.push({ to, msg });
  const alive = () => [...players.values()].filter(p => !p.health.dead);

  // The spawn farthest from every living player (other than `self`).
  function pickSpawn(self) {
    const others = alive().filter(p => p !== self);
    let best = spawns[0];
    let bestD = -1;
    for (const s of spawns) {
      const d = Math.min(1e9, ...others.map(p => Math.hypot(p.body.pos[0] - s.pos[0], p.body.pos[2] - s.pos[2])));
      const score = d + rand() * 0.5;
      if (score > bestD) {
        bestD = score;
        best = s;
      }
    }
    return best;
  }

  function add(name, primary) {
    let id = 0;
    while (players.has(id)) id++;
    if (id >= MAX_PLAYERS) return null;
    const p = {
      id, name: cleanName(name), primary: WEAPONS[primary]?.slot === 0 ? primary : undefined,
      body: null, loadout: null, health: createHealth(),
      get dead() { return this.health.dead; },
      respawnIn: 0, protectedFor: SPAWN_PROTECTION,
      queue: [], budget: 1, lastSeq: 0, queuedSeq: 0,
      history: [], shots: 0, kills: 0, deaths: 0,
    };
    p.body = createPlayer(pickSpawn(p));
    p.loadout = createLoadout(p.primary);
    players.set(id, p);
    dirty.roster = true;
    return id;
  }
  add(hostName, hostPrimary);

  // Same body and loadout objects, fresh contents (others hold references).
  function respawn(p) {
    Object.assign(p.body, createPlayer(pickSpawn(p)));
    Object.assign(p.loadout, createLoadout(p.primary));
    revive(p.health);
    p.protectedFor = SPAWN_PROTECTION;
    p.history = [];
  }

  // Where `p` was at host time `t` (ms), as an actor for hit tests.
  function rewound(p, t) {
    const h = p.history;
    let i = h.length - 1;
    while (i > 0 && h[i - 1].t >= t) i--;
    const b = h[i];
    const a = h[i - 1];
    let pos = p.body.pos;
    let height = p.body.height;
    if (b && t < now) {
      if (!a || t <= a.t) ({ pos, height } = a ?? b);
      else if (t >= b.t) ({ pos, height } = b);
      else {
        const k = (t - a.t) / (b.t - a.t);
        pos = a.pos.map((v, n) => v + (b.pos[n] - v) * k);
        height = b.height;
      }
    }
    return { id: p.id, pos, height, health: p.health, yaw: p.body.yaw, player: p };
  }

  // Everyone `shooter` could hit, as they were at the moment it was looking at.
  function targetsFor(shooter, view) {
    const t = shooter.id === HOST_ID ? now : Math.max(now - REWIND_MAX_MS, Math.min(now, view));
    const out = [];
    for (const p of players.values()) {
      if (p !== shooter && !p.health.dead && p.protectedFor <= 0) out.push(rewound(p, t));
    }
    return out;
  }

  function hurt(victim, amount, { attacker, part = "body", weapon, from }) {
    if (victim.protectedFor > 0) return;
    const { dealt, killed } = applyDamage(victim.health, amount);
    if (!dealt) return;
    tell(victim.id, { t: "hurt", from: from.map(v => +v.toFixed(2)), self: attacker === victim });
    if (attacker !== victim) tell(attacker.id, { t: "hit", kind: killed ? "kill" : part === "head" ? "head" : "hit" });
    if (!killed) return;
    victim.deaths++;
    if (attacker !== victim) attacker.kills++;
    victim.respawnIn = RESPAWN_DELAY;
    victim.loadout.ads = false;
    drops.push(...rollDrops(victim.body.pos, victim.loadout.slots[0], rand));
    dirty.drops = dirty.roster = true;
    tell(null, { t: "kill", killer: attacker.id, victim: victim.id, weapon, headshot: part === "head" });
  }

  const eyeOf = (p) => [p.body.pos[0], p.body.pos[1] + eyeHeight(p.body), p.body.pos[2]];

  function fire(p, e, cmd) {
    const w = WEAPONS[e.weapon];
    const origin = eyeOf(p);
    const targets = targetsFor(p, cmd.view);
    p.shots++;
    for (const [ox, oy] of e.pellets) {
      const d = direction(p.body.yaw + ox, p.body.pitch + oy);
      const end = origin.map((v, i) => v + d[i] * w.range);
      const wall = raycastWorld(origin, end, map.boxes);
      const hit = raycastActors(origin, end, targets, p.id);
      if (hit && (!wall || hit.t < wall.t)) {
        hurt(hit.actor.player, shotDamage(w, hit.t * w.range, hit.part), { attacker: p, part: hit.part, weapon: e.weapon, from: p.body.pos });
      }
    }
  }

  function stab(p, e, cmd) {
    const origin = eyeOf(p);
    const d = direction(p.body.yaw, p.body.pitch);
    const end = origin.map((v, i) => v + d[i] * e.range);
    const wall = raycastWorld(origin, end, map.boxes);
    const hit = raycastActors(origin, end, targetsFor(p, cmd.view), p.id);
    if (hit && (!wall || hit.t < wall.t)) {
      hurt(hit.actor.player, meleeDamage(WEAPONS.knife, p.body.yaw, hit.actor.yaw), { attacker: p, part: hit.part, weapon: "knife", from: p.body.pos });
    }
  }

  function toss(p) {
    const w = WEAPONS.grenade;
    const d = direction(p.body.yaw, Math.min(p.body.pitch + THROW_LIFT, Math.PI / 2));
    const start = eyeOf(p).map((v, i) => v + d[i] * 0.3);
    grenades.push({ ...createGrenade(start, d, w.throwSpeed, w.fuse, p.body.vel), owner: p.id });
  }

  // E: swap the primary for a dropped gun in reach.
  function pickUpGun(p) {
    const d = drops.find(x => x.kind === "gun" && nearDrop(x, p.body.pos));
    if (!d) return;
    const left = swapPrimary(p.loadout, d, p.body.pos);
    d.ttl = 0;
    if (left) drops.push(left);
    drops = drops.filter(x => x.ttl > 0);
    dirty.drops = true;
    tell(p.id, { t: "pickup", text: left ? `Picked up ${WEAPONS[d.weapon].name}` : `+${d.mag + d.reserve} ammo` });
  }

  // One command of one player; returns the weapon step's { events, kick }.
  function apply(p, cmd) {
    const out = runCommand(p, cmd, map.boxes);
    for (const e of out.events) {
      if (e.type === "shot") fire(p, e, cmd);
      else if (e.type === "melee") stab(p, e, cmd);
      else if (e.type === "throw") toss(p);
    }
    if (cmd.use && !p.health.dead) pickUpGun(p);
    return out;
  }

  return {
    players,
    events,
    add,
    remove(id) {
      if (id !== HOST_ID && players.delete(id)) dirty.roster = true;
    },
    roster: () => [...players.values()].map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths })),
    dropList: () => drops.map(({ id, kind, pos, weapon }) => ({ id, kind, pos: pos.map(v => +v.toFixed(2)), weapon })),
    // True once since the last call if the roster / the drops changed.
    changed(what) {
      const was = dirty[what];
      dirty[what] = false;
      return was;
    },

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

    // One host tick at host time `time` (ms). `local` is the host player's
    // own command (without a number); returns its weapon { events, kick }.
    tick(local, time) {
      now = time;
      let mine = null;
      for (const p of players.values()) {
        if (p.id === HOST_ID) {
          mine = apply(p, { ...local, seq: ++hostSeq, view: now });
        } else {
          p.budget = Math.min(BUDGET_MAX, p.budget + 1);
          while (p.queue.length && p.budget >= 1) {
            const c = p.queue.shift();
            apply(p, c);
            p.lastSeq = c.seq;
            p.budget--;
          }
        }
      }

      for (const p of players.values()) {
        if (p.health.dead) {
          p.respawnIn -= STEP;
          if (p.respawnIn <= 0) respawn(p);
          continue;
        }
        p.protectedFor = Math.max(0, p.protectedFor - STEP);
        stepHealth(p.health, STEP);
        // Walk-over pickups.
        for (const d of drops) {
          if (d.kind === "gun" || d.ttl <= 0 || !nearDrop(d, p.body.pos)) continue;
          const got = takeDrop(p.loadout, d);
          if (!got) continue;
          d.ttl = 0;
          dirty.drops = true;
          tell(p.id, { t: "pickup", text: got });
        }
        p.history.push({ t: now, pos: [...p.body.pos], height: p.body.height });
        while (p.history.length > 2 && p.history[0].t < now - HISTORY_MS) p.history.shift();
      }

      for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        if (!stepGrenade(g, STEP, map.boxes)) continue;
        grenades.splice(i, 1);
        const w = WEAPONS.grenade;
        tell(null, { t: "boom", pos: g.pos.map(v => +v.toFixed(2)) });
        const owner = players.get(g.owner);
        const inRange = alive().map(p => ({ pos: p.body.pos, height: p.body.height, health: p.health, player: p }));
        for (const { actor, amount } of explosionDamage(g.pos, w.radius, w.damage, inRange, map.boxes)) {
          hurt(actor.player, amount, { attacker: owner ?? actor.player, weapon: "grenade", from: g.pos });
        }
      }

      const before = drops.length;
      drops = stepDrops(drops, STEP);
      if (drops.length !== before) dirty.drops = true;
      return mine;
    },

    // What player `id` is sent: its own exact state, everyone else, grenades.
    snapshotFor(id, tick) {
      const me = players.get(id);
      if (!me) return null;
      const others = [];
      for (const p of players.values()) {
        if (p === me) continue;
        const b = p.body;
        others.push({
          id: p.id, pos: b.pos, yaw: b.yaw, pitch: b.pitch, onGround: b.onGround, crouched: b.crouched,
          dead: p.health.dead, weapon: activeWeapon(p.loadout).id, shots: p.shots,
        });
      }
      const b = me.body;
      return {
        tick, time: now, ack: me.lastSeq,
        self: {
          pos: b.pos, vel: b.vel, yaw: b.yaw, pitch: b.pitch, onGround: b.onGround, crouched: b.crouched,
          dead: me.health.dead, hp: me.health.hp, respawnIn: Math.max(0, me.respawnIn), loadout: loadoutState(me.loadout),
        },
        others,
        grenades: grenades.map(g => g.pos),
      };
    },
    grenades: () => grenades,
  };
}
