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
//
// The match is Team Deathmatch: two teams, bots (engine/ai.js, the same
// brains as single-player) filling each team up to its size and making way
// when people join, first team to the kill limit or ahead when time runs
// out wins, then a short intermission and a fresh match. The host can pick
// the next match's map at any time; it takes over when that match starts.
// Pure: no PeerJS/DOM. What should be told to whom is queued in `events`.
import { createPlayer, eyeHeight } from "../engine/player.js";
import { createLoadout, activeWeapon, WEAPONS } from "../engine/weapons.js";
import {
  createHealth, applyDamage, stepHealth, revive, raycastActors, shotDamage, meleeDamage, explosionDamage,
} from "../engine/damage.js";
import { raycastWorld } from "../engine/geometry.js";
import { createGrenade, stepGrenade } from "../engine/projectile.js";
import { rollDrops, stepDrops, nearDrop, takeDrop, swapPrimary } from "../engine/pickups.js";
import { createBot, resetBot, thinkBot, hear, notifyDamage, DIFFICULTY, HEARING_RANGE, BOT_HEADSHOT_CAP } from "../engine/ai.js";
import { buildNavGraph } from "../engine/nav.js";
import { STEP } from "../engine/loop.js";
import { MAX_PLAYERS } from "./protocol.js";
import { runCommand, direction, loadoutState } from "./command.js";

export const HOST_ID = 0;
export const RESPAWN_DELAY = 3;      // s dead before respawning
export const SPAWN_PROTECTION = 2;   // s after (re)spawning that damage is ignored
export const REWIND_MAX_MS = 400;    // furthest back a shot is checked
export const INTERMISSION = 10;      // s between matches
export const TEAMS = ["a", "b"];
export const TEAM_MAX = MAX_PLAYERS / 2;
// What the host can set for a match.
export const DEFAULT_OPTIONS = { teamSize: 2, bots: true, difficulty: "normal", killLimit: 20, minutes: 10, friendlyFire: false };
const BOT_NAMES = ["Vega", "Rook", "Onyx", "Lynx", "Halo", "Echo", "Dune", "Blitz"];
const HISTORY_MS = 600;
const BUDGET_MAX = 8;        // commands a player may have saved up
const QUEUE_MAX = 60;        // commands kept waiting (1 s); older ones are dropped
const NAME_MAX = 16;
const THROW_LIFT = 0.18;     // grenades leave the hand a little above the aim line

export const cleanName = (name) => String(name ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, NAME_MAX) || "Player";

export function createHostSim(firstMap, hostName, { hostPrimary, rand = Math.random, options = {} } = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  opts.teamSize = Math.max(1, Math.min(TEAM_MAX, Math.round(opts.teamSize)));
  let map = firstMap;
  let nextMap = firstMap;   // the map the next match is played on
  const botWorld = { boxes: map.boxes, nav: opts.bots ? buildNavGraph(map) : null, actors: [] };
  const players = new Map();
  // "playing" until a team wins (or the host ends it), then "over" for
  // INTERMISSION seconds. `mapGen` counts map changes (0–255, wrapping): it
  // goes out in every snapshot so a guest can tell which map one belongs to.
  const match = {
    state: "playing", timeLeft: opts.minutes * 60, scores: { a: 0, b: 0 }, winner: null, restartIn: 0,
    ended: null, mapGen: 0,
  };
  let botSeq = 0;
  let sinceRoster = 0;
  const events = [];   // { to: player id, or null for everyone; msg }
  let grenades = [];   // { ...grenade, owner }
  let drops = [];
  let now = 0;         // host clock (ms) of the tick being simulated
  let hostSeq = 0;
  let dirty = { roster: false, drops: false };

  const tell = (to, msg) => events.push({ to, msg });
  const alive = () => [...players.values()].filter(p => !p.health.dead);

  // The team's spawn farthest from every living enemy.
  function pickSpawn(self) {
    const others = alive().filter(p => p.team !== self.team);
    const spawns = map.teamSpawns[self.team];
    let best = spawns[0];
    let bestD = -1;
    for (const s of spawns) {
      const d = Math.min(1e9, ...others.map(p => Math.hypot(p.body.pos[0] - s.pos[0], p.body.pos[2] - s.pos[2])));
      // Not on top of someone already standing there.
      const taken = alive().some(p => p !== self && Math.hypot(p.body.pos[0] - s.pos[0], p.body.pos[2] - s.pos[2]) < 1.5);
      const score = d + rand() * 0.5 - (taken ? 1e6 : 0);
      if (score > bestD) {
        bestD = score;
        best = s;
      }
    }
    return best;
  }

  const humansOn = (team) => [...players.values()].filter(p => !p.bot && p.team === team).length;
  const botsOn = (team) => [...players.values()].filter(p => p.bot && p.team === team);
  const freeId = () => {
    let id = 0;
    while (players.has(id)) id++;
    return id < MAX_PLAYERS ? id : null;
  };

  // A body doubles as the "actor" the bots' brains look at.
  const tag = (p) => Object.assign(p.body, { id: p.id, team: p.team, health: p.health });

  function record(id, name, team, extra) {
    return {
      id, name, team, bot: false, primary: undefined,
      body: null, loadout: null, health: null,
      get dead() { return this.health.dead; },
      respawnIn: 0, protectedFor: SPAWN_PROTECTION,
      queue: [], budget: 1, lastSeq: 0, queuedSeq: 0,
      history: [], shots: 0, kills: 0, deaths: 0, ping: 0, seq: 0,
      ...extra,
    };
  }

  // Keep each team at its size with bots, making way for people.
  function fillBots() {
    for (const team of TEAMS) {
      const bots = botsOn(team);
      const want = opts.bots ? Math.max(0, opts.teamSize - humansOn(team)) : 0;
      while (bots.length > want) players.delete(bots.pop().id);
      for (let n = bots.length; n < want; n++) {
        const id = freeId();
        if (id === null) break;
        const skill = DIFFICULTY[opts.difficulty] ?? DIFFICULTY.normal;
        const p = record(id, `${BOT_NAMES[botSeq++ % BOT_NAMES.length]} [bot]`, team, { bot: true });
        p.primary = skill.primaries[Math.floor(rand() * skill.primaries.length)];
        p.body = createBot({ id, team, spawn: pickSpawn(p), primary: p.primary, skill });
        p.loadout = p.body.loadout;
        p.health = p.body.health;
        players.set(id, p);
      }
    }
    dirty.roster = true;
  }

  // A person joins: the asked-for team if it has room, else the smaller one.
  function add(name, primary, wanted) {
    const team = TEAMS.includes(wanted) && humansOn(wanted) < TEAM_MAX ? wanted
      : humansOn("a") <= humansOn("b") ? "a" : "b";
    if (humansOn(team) >= TEAM_MAX) return null;
    // A bot on that team steps aside if the team is at its size.
    const bots = botsOn(team);
    if (bots.length && humansOn(team) + bots.length >= opts.teamSize) players.delete(bots.pop().id);
    const id = freeId();
    if (id === null) return null;
    const p = record(id, cleanName(name), team, { primary: WEAPONS[primary]?.slot === 0 ? primary : undefined });
    p.health = createHealth();
    p.body = createPlayer(pickSpawn(p));
    p.loadout = createLoadout(p.primary);
    tag(p);
    players.set(id, p);
    fillBots();
    return id;
  }
  add(hostName, hostPrimary);

  // Same body object, fresh contents (others hold references).
  function respawn(p) {
    if (p.bot) {
      resetBot(p.body, pickSpawn(p), p.primary);
      p.loadout = p.body.loadout;
      p.health = p.body.health;
    } else {
      Object.assign(p.body, createPlayer(pickSpawn(p)));
      Object.assign(p.loadout, createLoadout(p.primary));
      revive(p.health);
    }
    p.respawnIn = 0;
    p.protectedFor = SPAWN_PROTECTION;
    p.history = [];
    p.queue.length = 0;
  }

  // `ended`: "score" (kill limit or time) or "host" (ended early by the host).
  function endMatch(winner, ended = "score") {
    match.state = "over";
    match.winner = winner;
    match.ended = ended;
    match.restartIn = INTERMISSION;
    dirty.roster = true;
  }

  function newMatch() {
    Object.assign(match, { state: "playing", timeLeft: opts.minutes * 60, scores: { a: 0, b: 0 }, winner: null, restartIn: 0, ended: null });
    if (nextMap !== map) {
      map = nextMap;
      botWorld.boxes = map.boxes;
      botWorld.nav = opts.bots ? buildNavGraph(map) : null;
      match.mapGen = (match.mapGen + 1) & 255;
    }
    grenades = [];
    drops = [];
    for (const p of players.values()) {
      p.kills = p.deaths = 0;
      respawn(p);
    }
    dirty.roster = dirty.drops = true;
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
      if (p === shooter || p.health.dead || p.protectedFor > 0) continue;
      if (p.team === shooter.team && !opts.friendlyFire) continue;
      out.push(rewound(p, t));
    }
    return out;
  }

  function hurt(victim, amount, { attacker, part = "body", weapon, from }) {
    if (victim.protectedFor > 0) return;
    const { dealt, killed } = applyDamage(victim.health, amount);
    if (!dealt) return;
    tell(victim.id, { t: "hurt", from: from.map(v => +v.toFixed(2)), self: attacker === victim });
    if (attacker !== victim) tell(attacker.id, { t: "hit", kind: killed ? "kill" : part === "head" ? "head" : "hit" });
    if (!killed) {
      if (victim.bot && attacker !== victim) notifyDamage(victim.body, attacker.body.pos);
      return;
    }
    victim.deaths++;
    if (attacker !== victim && attacker.team !== victim.team) {
      attacker.kills++;
      match.scores[attacker.team]++;
      if (match.scores[attacker.team] >= opts.killLimit) endMatch(attacker.team);
    } else if (attacker !== victim) {
      attacker.kills--; // a team kill costs one
    }
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
    const scale = p.bot ? p.body.skill.damage : 1;
    const maxHeadshot = p.bot ? BOT_HEADSHOT_CAP : Infinity;
    p.shots++;
    // Bots in earshot come looking.
    for (const b of players.values()) {
      if (b.bot && b !== p && !b.health.dead && b.team !== p.team
        && Math.hypot(b.body.pos[0] - origin[0], b.body.pos[2] - origin[2]) <= HEARING_RANGE.shot) hear(b.body, p.body.pos);
    }
    for (const [ox, oy] of e.pellets) {
      const d = direction(p.body.yaw + ox, p.body.pitch + oy);
      const end = origin.map((v, i) => v + d[i] * w.range);
      const wall = raycastWorld(origin, end, map.boxes);
      const hit = raycastActors(origin, end, targets, p.id);
      if (hit && (!wall || hit.t < wall.t)) {
        hurt(hit.actor.player, shotDamage(w, hit.t * w.range, hit.part, maxHeadshot) * scale, { attacker: p, part: hit.part, weapon: e.weapon, from: p.body.pos });
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
      if (id === HOST_ID || players.get(id)?.bot !== false) return;
      players.delete(id);
      fillBots();
    },
    options: opts,
    match,
    get map() { return map; },
    // The map the next match is played on (the current one by default).
    setNextMap(m) {
      if (!m?.boxes || !m.teamSpawns?.a?.length || !m.teamSpawns?.b?.length) return false;
      nextMap = m;
      dirty.roster = true;
      return true;
    },
    // End the match now, with no winner: the intermission, then the next map.
    endNow() {
      if (match.state !== "playing") return false;
      endMatch(null, "host");
      return true;
    },
    roster: () => [...players.values()].map(p => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, kills: p.kills, deaths: p.deaths, ping: p.ping })),
    matchState: () => ({
      state: match.state, timeLeft: Math.max(0, Math.ceil(match.timeLeft)), scores: { ...match.scores },
      winner: match.winner, restartIn: Math.ceil(match.restartIn), killLimit: opts.killLimit,
      ended: match.ended, mapId: map.id, nextMapId: nextMap.id, mapGen: match.mapGen,
    }),
    // A person changes sides (if there's room): they respawn with their new team.
    setTeam(id, team) {
      const p = players.get(id);
      if (!p || p.bot || !TEAMS.includes(team) || p.team === team || humansOn(team) >= TEAM_MAX) return false;
      p.team = team;
      // Make room first: the bots on the new team may fill every free slot.
      const bots = botsOn(team);
      if (bots.length && humansOn(team) + bots.length > opts.teamSize) players.delete(bots.pop().id);
      tag(p);
      respawn(p);
      fillBots();
      return true;
    },
    // The primary a person will carry from their next respawn.
    setPrimary(id, weapon) {
      const p = players.get(id);
      if (p && !p.bot && WEAPONS[weapon]?.slot === 0) p.primary = weapon;
    },
    setPing(id, ms) {
      const p = players.get(id);
      if (p && Number.isFinite(ms)) p.ping = Math.max(0, Math.min(999, Math.round(ms)));
    },
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
      if (!p || p.bot || id === HOST_ID) return;
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
      // The clock: once a second everyone is told the time and the scores.
      if ((sinceRoster += STEP) >= 1) {
        sinceRoster = 0;
        dirty.roster = true;
      }
      if (match.state === "over") {
        // Intermission: nobody acts; commands are acknowledged and dropped.
        for (const p of players.values()) {
          if (p.queue.length) p.lastSeq = p.queue[p.queue.length - 1].seq;
          p.queue.length = 0;
        }
        if ((match.restartIn -= STEP) <= 0) newMatch();
        return { events: [], kick: [0, 0] };
      }
      match.timeLeft -= STEP;
      if (match.timeLeft <= 0) {
        const { a, b } = match.scores;
        endMatch(a === b ? null : a > b ? "a" : "b");
      }

      botWorld.actors = [...players.values()].map(p => p.body);
      for (const p of [...players.values()]) {
        if (p.id === HOST_ID) {
          mine = apply(p, { ...local, seq: ++hostSeq, view: now });
        } else if (p.bot) {
          if (p.health.dead) continue;
          const { move, weapon } = thinkBot(p.body, botWorld, STEP, rand);
          apply(p, { input: { ...move, ads: false }, weapon, use: false, yaw: p.body.yaw, pitch: p.body.pitch, seq: ++p.seq, view: now });
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
        // Teammates are spared (unless friendly fire is on); the thrower isn't.
        const inRange = alive()
          .filter(p => p === owner || !owner || opts.friendlyFire || p.team !== owner.team)
          .map(p => ({ pos: p.body.pos, height: p.body.height, health: p.health, player: p }));
        for (const { actor, amount } of explosionDamage(g.pos, w.radius, w.damage, inRange, map.boxes)) {
          hurt(actor.player, amount, { attacker: owner ?? actor.player, weapon: "grenade", from: g.pos });
        }
        for (const b of players.values()) {
          if (b.bot && !b.health.dead && Math.hypot(b.body.pos[0] - g.pos[0], b.body.pos[2] - g.pos[2]) <= HEARING_RANGE.explosion) hear(b.body, g.pos);
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
        tick, time: now, ack: me.lastSeq, gen: match.mapGen,
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
