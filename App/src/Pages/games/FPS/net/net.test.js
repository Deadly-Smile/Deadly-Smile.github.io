// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the netcode: wire format, the host's simulation,
// guest prediction and interpolation, and all of them together over a
// simulated slow, lossy link. Run with:
//   node src/Pages/games/FPS/net/net.test.js
import {
  encodeCommands, decodeCommands, encodeSnapshot, decodeSnapshot, packKeys, unpackKeys, MAX_PLAYERS, CMD_REDUNDANCY,
} from "./protocol.js";
import { createHostSim, cleanName, HOST_ID, RESPAWN_DELAY, SPAWN_PROTECTION } from "./hostSim.js";
import { seededRand, loadoutState } from "./command.js";
import { WEAPONS, createLoadout } from "../engine/weapons.js";
import { EYE_HEIGHT } from "../engine/geometry.js";
import { perimeter, spawn } from "../maps/build.js";
import { createPredictor } from "./predict.js";
import { createInterpolator, DELAY_MS } from "./interp.js";
import { getMap } from "../maps/index.js";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`✗ ${name}`);
    console.error("  expected:", JSON.stringify(expected));
    console.error("  actual:  ", JSON.stringify(actual));
  } else {
    console.log(`✓ ${name}`);
  }
}
const r = (v, d = 2) => +v.toFixed(d);
const NONE = { forward: false, back: false, left: false, right: false, jump: false, sprint: false, crouch: false, ads: false };
const keys = (k) => ({ ...NONE, ...k });
const NO_WEAPON = { fire: false, ads: false, reload: false, lastWeapon: false, slot: null, scroll: 0 };
// A command (without its number) from movement keys, weapon buttons and angles.
const act = (k = {}, w = {}, extra = {}) => ({ input: keys(k), weapon: { ...NO_WEAPON, ...w, ads: !!k.ads }, use: false, pitch: 0, view: 0, ...extra });
const IDLE = act();
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const seeded = (s = 99) => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ─── Wire format ─────────────────────────────────────────────────────────────
const SELF = {
  pos: [1.5, 0.25, -12.75], vel: [4.5, -2, 0.5], yaw: 0.5, pitch: -0.25, onGround: false, crouched: true, dead: false,
  hp: 73, respawnIn: 0, loadout: loadoutState(createLoadout("shotgun")),
};
{
  const input = keys({ forward: true, jump: true, crouch: true });
  check("keys survive packing", unpackKeys(packKeys(input)), input);

  const cmds = [
    { seq: 41, ...act({ left: true, ads: true }, { fire: true, slot: 2 }, { yaw: 1.25, pitch: -0.5, view: 123456 }) },
    { seq: 42, ...act({ sprint: true, forward: true }, { reload: true, lastWeapon: true, scroll: -1 }, { yaw: -3, pitch: 0.25, use: true }) },
  ];
  const ordered = (c) => ({ seq: c.seq, input: c.input, weapon: c.weapon, use: c.use, yaw: c.yaw, pitch: c.pitch, view: c.view });
  check("commands round-trip", decodeCommands(encodeCommands(cmds)), cmds.map(ordered));
  check("a command is 19 bytes", encodeCommands(cmds).byteLength, 2 + 2 * 19);
  check("garbage is rejected", [decodeCommands(new ArrayBuffer(5)), decodeCommands("hi"), decodeCommands(encodeSnapshot({ tick: 1, time: 1, ack: 0, self: SELF, others: [] }))], [null, null, null]);
  const bad = encodeCommands(cmds);
  new DataView(bad).setFloat32(9, NaN);
  check("non-finite angles are rejected", decodeCommands(bad), null);

  const snap = {
    tick: 1234, time: 98765, ack: 77, self: SELF,
    others: [
      { id: 3, pos: [-20.13, 1.2, 31.99], yaw: 2.5, pitch: 0.7, onGround: true, crouched: false, dead: false, weapon: "sniper", shots: 200 },
      { id: 7, pos: [0, 0, 0], yaw: -3.1, pitch: -1.5, onGround: true, crouched: true, dead: true, weapon: "knife", shots: 3 },
    ],
    grenades: [[1.25, 0.08, -3.5]],
  };
  const back = decodeSnapshot(encodeSnapshot(snap));
  check("snapshot header round-trips", [back.tick, back.time, back.ack], [1234, 98765, 77]);
  check("own state is exact, weapons included", back.self, snap.self);
  const odd = { ...snap, self: { ...SELF, pos: [0.1 + 0.2, 1 / 3, -Math.PI], vel: [1e-9, 2 / 3, 0], loadout: { ...SELF.loadout, cooldown: 0.1 + 0.2, bloom: 1 / 3 } } };
  const oddBack = decodeSnapshot(encodeSnapshot(odd)).self;
  check("…to the last bit, for any position and timer", [oddBack.pos, oddBack.vel, oddBack.loadout.cooldown, oddBack.loadout.bloom], [odd.self.pos, odd.self.vel, 0.1 + 0.2, 1 / 3]);
  check("others: ids, flags, weapon, shot counter", back.others.map(p => [p.id, p.onGround, p.crouched, p.dead, p.weapon, p.shots]), [[3, true, false, false, "sniper", 200], [7, true, true, true, "knife", 3]]);
  check("others: positions to the centimetre", back.others[0].pos, [-20.13, 1.2, 31.99]);
  check("others: angles to well under a degree", back.others.every((p, i) => Math.abs(p.yaw - snap.others[i].yaw) < 0.001 && Math.abs(p.pitch - snap.others[i].pitch) < 0.01), true);
  check("grenades to the centimetre", back.grenades, [[1.25, 0.08, -3.5]]);
  check("7 other players and a grenade fit in under 230 bytes", encodeSnapshot({ ...snap, others: Array(7).fill(snap.others[0]) }).byteLength < 230, true);
  check("a truncated snapshot is rejected", decodeSnapshot(encodeSnapshot(snap).slice(0, 90)), null);

  const a = seededRand(42);
  const b = seededRand(42);
  check("seeded randomness repeats", [a(), a(), a()], [b(), b(), b()]);
  check("…and differs by seed", seededRand(1)() !== seededRand(2)(), true);
}

// ─── Host simulation: rooms and movement ─────────────────────────────────────
const map = getMap("arena");
let clock = 0;
const tick = (sim, local = IDLE) => sim.tick({ yaw: 0, ...local }, clock += 1000 / 60);
{
  check("names are cleaned", [cleanName("  <b>Al!ce</b> "), cleanName(""), cleanName("x".repeat(40)).length], ["bAlceb", "Player", 16]);
  const sim = createHostSim(map, "Host");
  const ids = [];
  for (let i = 0; i < MAX_PLAYERS + 2; i++) ids.push(sim.add(`g${i}`));
  check("room holds 8 including the host", ids, [1, 2, 3, 4, 5, 6, 7, null, null, null]);
  sim.remove(3);
  check("a freed slot is reused", sim.add("late"), 3);
  sim.remove(HOST_ID);
  check("the host can't be removed", sim.players.has(HOST_ID), true);
  const spots = new Set([...sim.players.values()].map(p => p.body.pos.join(",")));
  check("everyone spawns somewhere different", spots.size, MAX_PLAYERS);
  check("the roster carries scores", sim.roster()[0], { id: 0, name: "Host", kills: 0, deaths: 0 });
}
{
  const sim = createHostSim(map, "Host");
  const id = sim.add("guest");
  const p = sim.players.get(id);
  const start = [...p.body.pos];
  const yaw = p.body.yaw;
  const cmd = (seq) => ({ seq, ...act({ forward: true }, {}, { yaw }) });

  sim.receive(id, [cmd(1), cmd(2)]);
  sim.receive(id, [cmd(1), cmd(2), cmd(3)]); // the redundancy repeats 1 and 2
  check("repeated commands are queued once", p.queue.length, 3);
  tick(sim); tick(sim); tick(sim);
  check("applied in order and acknowledged", sim.snapshotFor(id, 3).ack, 3);
  check("the guest moved", Math.hypot(p.body.pos[0] - start[0], p.body.pos[2] - start[2]) > 0.05, true);

  // Speed hack: 300 commands at once are worth 5 s of movement — but the
  // host hands out one per tick.
  sim.receive(id, Array.from({ length: 300 }, (_, i) => cmd(4 + i)));
  check("a flood is trimmed to a second's worth", p.queue.length, 60);
  for (let i = 0; i < 10; i++) tick(sim);
  check("…and applied at about one per tick", 60 - p.queue.length <= 10 + 8, true);

  check("a snapshot lists everyone else", sim.snapshotFor(id, 0).others.map(o => o.id), [HOST_ID]);
  check("no snapshot for someone who left", sim.snapshotFor(5, 0), null);
}

// ─── Host simulation: combat ─────────────────────────────────────────────────
// A bare 40 × 40 room: the host (player 0) and a guest (player 1) placed by
// hand, facing each other 10 m apart.
const range = {
  id: "range", size: [40, 40], boxes: perimeter(40, 40, 4),
  playerSpawns: [spawn(0, 0, 0)],
  teamSpawns: { a: [spawn(-15, 0, 15), spawn(15, 0, 15)], b: [spawn(-15, 0, -15), spawn(15, 0, -15)] },
};
function duel(opts = {}) {
  const sim = createHostSim(range, "Host", { rand: seededRand(3), ...opts });
  const id = sim.add("guest", "rifle");
  const host = sim.players.get(HOST_ID);
  const guest = sim.players.get(id);
  const place = (p, x, z, yaw) => { p.body.pos = [x, 0, z]; p.body.prev = [x, 0, z]; p.body.vel = [0, 0, 0]; p.body.yaw = yaw; p.history = []; };
  place(host, 0, 5, 0);            // looking toward -z, at the guest
  place(guest, 0, -5, Math.PI);    // looking back
  let seq = 0;
  // The guest sends one command per tick; returns the events queued that tick.
  const step = (g = IDLE, h = IDLE) => {
    sim.events.length = 0;
    seq = Math.max(seq, guest.queuedSeq) + 1;
    sim.receive(id, [{ seq, ...g, yaw: g.yaw ?? Math.PI, view: g.view || clock }]);
    tick(sim, { ...h, yaw: h.yaw ?? 0 });
    return sim.events.map(e => ({ to: e.to, ...e.msg }));
  };
  const settle = () => { for (let i = 0; i < SPAWN_PROTECTION * 60 + 5; i++) step(); };
  return { sim, host, guest, step, settle, place };
}
// Aim from a shooter's eye at a target's chest.
const aimPitch = (dist) => Math.atan2(1.1 - EYE_HEIGHT, dist);
{
  const { host, guest, step, settle } = duel();
  // Aiming down sights, so the rifle's spread at 10 m is a few centimetres.
  const AIM = { ads: true };
  let ev = step(act(AIM, { fire: true }, { pitch: aimPitch(10) }));
  check("fresh spawns are protected from damage", [host.health.hp, ev.some(e => e.t === "hit")], [100, false]);
  settle();
  for (let i = 0; i < 10; i++) step(act(AIM));

  ev = step(act(AIM, { fire: true }, { pitch: aimPitch(10) }));
  check("a shot on target damages the victim", host.health.hp, 100 - WEAPONS.rifle.damage);
  check("the shooter is told it hit, the victim that it was hurt", [ev.find(e => e.t === "hit")?.to, ev.find(e => e.t === "hurt")?.to], [guest.id, HOST_ID]);
  check("the shot is counted for others to see", guest.shots >= 1, true);
  for (let i = 0; i < 10; i++) step(act(AIM));

  // Head height: the eye line is level with the head.
  host.health.hp = 100;
  ev = step(act(AIM, { fire: true }, { pitch: 0 }));
  check("a level shot at this range is a headshot", [ev.find(e => e.t === "hit")?.kind, host.health.hp], ["head", 100 - WEAPONS.rifle.damage * WEAPONS.rifle.headshot]);
  for (let i = 0; i < 10; i++) step(act(AIM));

  host.health.hp = 100;
  ev = step(act(AIM, { fire: true }, { pitch: 0.6 }));
  check("a shot over their head misses", [host.health.hp, ev.length], [100, 0]);
}
{
  // Fire rate and ammo are the host's, whatever the guest sends.
  const { sim, host, guest, step, settle } = duel();
  settle();
  host.health.max = host.health.hp = 1e6;
  for (let i = 0; i < 60; i++) step(act({}, { fire: true }, { pitch: aimPitch(10) }));
  check("holding fire for a second: the rifle's rate, no more", guest.shots, Math.floor((59 / 60) / (60 / WEAPONS.rifle.rpm)) + 1);
  // A guest flooding fire commands gets no extra shots per second.
  const before = guest.loadout.ammo.rifle.mag + guest.loadout.ammo.rifle.reserve;
  const flood = Array.from({ length: 600 }, (_, i) => ({ seq: 100000 + i, ...act({}, { fire: true }, { yaw: Math.PI, pitch: aimPitch(10), view: clock }) }));
  sim.receive(guest.id, flood);
  for (let i = 0; i < 60; i++) tick(sim, { ...IDLE, yaw: 0 });
  const spent = before - (guest.loadout.ammo.rifle.mag + guest.loadout.ammo.rifle.reserve);
  check("600 fire commands at once still fire at most about a second's worth", spent <= 13, true);

  // Out of ammo means no more hits, however long the trigger is held.
  guest.loadout.ammo.rifle = { mag: 2, reserve: 0 };
  guest.loadout.reloading = 0;
  guest.queue.length = 0;
  guest.loadout.cooldown = 0;
  const fired = guest.shots;
  for (let i = 0; i < 120; i++) step(act({}, { fire: true }, { pitch: aimPitch(10) }));
  check("two rounds left → two shots, however long the trigger is held", guest.shots - fired, 2);
}
{
  // Lag compensation: the host strafes; the guest fires at where it saw the
  // host 150 ms ago.
  const run = (compensate) => {
    const { host, step, settle, place } = duel();
    settle();
    place(host, 0, 5, 0);
    host.health.hp = 100;
    const seen = [];
    for (let i = 0; i < 30; i++) {
      step(IDLE, act({ right: true }, {}, {}));
      seen.push({ t: clock, x: host.body.pos[0] });
    }
    // The guest is drawing the host as it was 9 ticks (150 ms) ago, and aims there.
    const past = seen[seen.length - 9];
    const dx = past.x - 0;
    const aimYaw = Math.atan2(-dx, -10); // from (0, -5) toward (past.x, 5)
    const moved = host.body.pos[0] - past.x;
    for (let i = 0; i < 3; i++) step(act({ ads: true }, {}, { yaw: aimYaw }), act({ right: true }));
    past.t += 3 * 1000 / 60; // …still 150 ms behind: aim at where it was then
    step(act({ ads: true }, { fire: true }, { yaw: aimYaw, pitch: aimPitch(Math.hypot(dx, 10)), view: compensate ? past.t : clock }), act({ right: true }));
    return { hp: host.health.hp, moved };
  };
  const withComp = run(true);
  const without = run(false);
  check("the target moved well clear of where it was seen", withComp.moved > 0.5, true);
  check("with lag compensation the shot counts", withComp.hp < 100, true);
  check("without it the same shot would have missed", without.hp, 100);

  // A guest can't claim to have been looking at the distant past.
  const { host, step, settle, place } = duel();
  settle();
  for (let i = 0; i < 120; i++) step(IDLE, act({ right: true }));
  const far = host.body.pos[0];
  place(host, far, 5, 0);
  host.health.hp = 100;
  for (let i = 0; i < 3; i++) step(act({ ads: true }));
  step(act({ ads: true }, { fire: true }, { pitch: aimPitch(10), view: 1 }));
  check("rewinding is capped: a 2 s old position can't be shot", [host.health.hp, far > 3], [100, true]);
}
{
  // Kills, respawns, scores, drops and pickups.
  const { sim, host, guest, step, settle } = duel();
  settle();
  let events = [];
  for (let i = 0; i < 90 && !host.health.dead; i++) events.push(...step(act({ ads: true }, { fire: true }, { pitch: aimPitch(10) })));
  check("enough hits kill", host.health.dead, true);
  const kill = events.find(e => e.t === "kill");
  check("everyone is told who killed whom with what", [kill.to, kill.killer, kill.victim, kill.weapon], [null, guest.id, HOST_ID, "rifle"]);
  check("scores", sim.roster().map(p => [p.kills, p.deaths]), [[0, 1], [1, 0]]);
  check("the roster and the drops are flagged as changed", [sim.changed("roster"), sim.changed("drops"), sim.changed("drops")], [true, true, false]);
  check("the victim dropped an ammo pack where it fell", sim.dropList().some(d => d.kind === "ammo" && Math.abs(d.pos[2] - 5) < 0.01), true);

  const deadAt = [...host.body.pos];
  for (let i = 0; i < 30; i++) step(IDLE, act({ forward: true }));
  check("the dead don't move or shoot", [host.body.pos, host.shots], [deadAt, 0]);
  check("…and the snapshot says so", [sim.snapshotFor(HOST_ID, 0).self.dead, sim.snapshotFor(guest.id, 0).others[0].dead], [true, true]);
  for (let i = 0; i < RESPAWN_DELAY * 60; i++) step();
  check("respawned at full health with a fresh loadout", [host.health.dead, host.health.hp, host.loadout.ammo.rifle.mag], [false, 100, WEAPONS.rifle.mag]);
  check("…somewhere away from the killer", Math.hypot(host.body.pos[0] - guest.body.pos[0], host.body.pos[2] - guest.body.pos[2]) > 15, true);

  // The guest walks over the ammo pack (10 m ahead of it).
  guest.loadout.ammo.rifle.reserve = 0;
  sim.changed("drops");
  let pickup = null;
  for (let i = 0; i < 200 && !pickup; i++) pickup = step(act({ forward: true })).find(e => e.t === "pickup") ?? null;
  check("walking over the pack gives ammo, and tells only that player", [pickup?.to, guest.loadout.ammo.rifle.reserve > 0, sim.changed("drops")], [guest.id, true, true]);
}
{
  // Grenades are the host's: thrown from a command, flown and exploded by it.
  const { sim, host, guest, step, settle } = duel();
  settle();
  step(act({}, { slot: 3 }));
  for (let i = 0; i < 30; i++) step();
  let ev = step(act({}, { fire: true }, { pitch: 0.15 }));
  check("a throw puts a grenade in flight", [sim.grenades().length, sim.snapshotFor(HOST_ID, 0).grenades.length, guest.loadout.ammo.grenade.mag], [1, 1, 1]);
  const all = [];
  for (let i = 0; i < 200; i++) {
    // Stand the host next to wherever it comes to rest.
    const g = sim.grenades()[0];
    if (g) host.body.pos = [g.pos[0] + 1, 0, g.pos[2]];
    all.push(...step());
  }
  ev = all;
  check("it explodes and everyone is told where", [sim.grenades().length, ev.filter(e => e.t === "boom").map(e => e.to)], [0, [null]]);
  check("…hurting whoever is near", host.health.hp < 60, true);

  // Your own grenade can kill you: a suicide scores a death, no kill.
  const solo = duel();
  solo.settle();
  solo.step(act({}, { slot: 3 }));
  for (let i = 0; i < 30; i++) solo.step();
  solo.step(act({}, { fire: true }, { pitch: -1.4 }));
  for (let i = 0; i < 200 && !solo.guest.health.dead; i++) {
    const g = solo.sim.grenades()[0];
    if (g) solo.guest.body.pos = [g.pos[0], 0, g.pos[2]]; // standing on it
    solo.step();
  }
  check("your own grenade at your feet kills you", solo.guest.health.dead, true);
  check("…counted as a death, not a kill", [solo.guest.kills, solo.guest.deaths], [0, 1]);
}
{
  // The knife needs to be close.
  const { host, step, settle, place } = duel();
  settle();
  step(act({}, { slot: 2 }));
  for (let i = 0; i < 30; i++) step();
  step(act({}, { fire: true }));
  check("a stab from 10 m does nothing", host.health.hp, 100);
  place(host, 0, -3.6, 0);
  for (let i = 0; i < 60; i++) step();
  step(act({}, { fire: true }));
  check("a stab at arm's length hurts", host.health.hp, 100 - WEAPONS.knife.damage);
}

// ─── Prediction over a perfect link ──────────────────────────────────────────
{
  const sim = createHostSim(map, "Host");
  const id = sim.add("guest", "smg");
  const gp = sim.players.get(id);
  const guest = createPredictor(id, { pos: [...gp.body.pos], yaw: gp.body.yaw }, "smg");
  const rand = seeded(5);
  let input = NONE;
  let weapon = NO_WEAPON;
  let yaw = 0;
  let worst = 0;
  let shotsPredicted = 0;
  for (let t = 0; t < 900; t++) {
    if (t % 15 === 0) {
      input = keys({ forward: rand() < 0.7, left: rand() < 0.3, right: rand() < 0.3, sprint: rand() < 0.4, crouch: rand() < 0.1, ads: rand() < 0.2 });
      weapon = { ...NO_WEAPON, fire: rand() < 0.5, reload: rand() < 0.1, slot: rand() < 0.1 ? Math.floor(rand() * 4) : null };
      yaw += (rand() - 0.5) * 1.5;
    }
    const out = guest.step({ input: { ...input, jump: rand() < 0.03 }, weapon: { ...weapon, ads: input.ads }, use: false, yaw, pitch: 0.1, view: clock }, map.boxes);
    shotsPredicted += out.events.filter(e => e.type === "shot").length;
    sim.receive(id, decodeCommands(encodeCommands(out.packet)));
    tick(sim);
    if (t % 3 === 0) {
      const snap = decodeSnapshot(encodeSnapshot(sim.snapshotFor(id, t)));
      worst = Math.max(worst, Math.hypot(...guest.reconcile(snap.self, snap.ack, map.boxes)));
    }
  }
  check("on a perfect link prediction never needs correcting (< 1 mm)", worst < 0.001, true);
  check("host and guest agree on where the guest is", dist(guest.body.pos, gp.body.pos) < 0.001, true);
  check("…and on every shot fired", [shotsPredicted > 20, shotsPredicted], [true, gp.shots]);
  check("…and on the ammo left", loadoutState(guest.loadout).ammo, loadoutState(gp.loadout).ammo);
}

// ─── Prediction over a slow, lossy link ──────────────────────────────────────
// 80 ms each way, 10% of packets lost in both directions.
{
  const sim = createHostSim(map, "Host");
  const id = sim.add("guest");
  const gp = sim.players.get(id);
  const guest = createPredictor(id, { pos: [...gp.body.pos], yaw: gp.body.yaw });
  const rand = seeded(17);
  const LAG = 5; // ticks ≈ 83 ms
  const up = [];   // [arrivalTick, buffer]
  const down = [];
  let input = NONE;
  let yaw = 0;
  let worst = 0;
  let corrections = 0;
  let t = 0;
  const run = (ticks, moving) => {
    for (let n = 0; n < ticks; n++) {
      t++;
      if (moving && t % 20 === 0) {
        input = keys({ forward: rand() < 0.8, left: rand() < 0.3, right: rand() < 0.3, sprint: rand() < 0.5 });
        yaw += (rand() - 0.5) * 2;
      }
      const c = { input: moving ? { ...input, jump: rand() < 0.02 } : NONE, weapon: { ...NO_WEAPON, fire: moving && rand() < 0.3 }, use: false, yaw, pitch: 0, view: clock };
      const { packet } = guest.step(c, map.boxes);
      if (rand() > 0.1) up.push([t + LAG, encodeCommands(packet)]);
      while (up.length && up[0][0] <= t) sim.receive(id, decodeCommands(up.shift()[1]));
      tick(sim);
      if (t % 3 === 0 && rand() > 0.1) down.push([t + LAG, encodeSnapshot(sim.snapshotFor(id, t))]);
      while (down.length && down[0][0] <= t) {
        const snap = decodeSnapshot(down.shift()[1]);
        const moved = Math.hypot(...guest.reconcile(snap.self, snap.ack, map.boxes));
        if (moved > 0.001) corrections++;
        worst = Math.max(worst, moved);
      }
    }
  };
  run(1200, true); // 20 s of running around
  check("losing 10% of packets rarely needs a correction (redundancy covers it)", corrections < 12, true);
  check("…and corrections stay small (< 0.5 m)", worst < 0.5, true);
  check("unacknowledged commands stay bounded (≈ round trip)", guest.pendingCount() < 30, true);
  run(120, false); // stand still for 2 s: everything in flight lands
  check("once the link settles, guest and host agree exactly", dist(guest.body.pos, gp.body.pos) < 0.001, true);
  check("…weapons included", loadoutState(guest.loadout).ammo, loadoutState(gp.loadout).ammo);
}

// ─── Interpolation ───────────────────────────────────────────────────────────
{
  const it = createInterpolator();
  const at = (x) => ({ id: 4, pos: [x, 0, 0], yaw: 0, pitch: 0, onGround: true, crouched: false });
  // Snapshots every 50 ms, each arriving 30 ms after it was stamped; the
  // player moves 5 m/s along x.
  for (let i = 0; i <= 10; i++) it.push(1000 + i * 50, [at(i * 0.25)], 5030 + i * 50);
  const now = 5030 + 500;
  const t = it.renderTime(now);
  check("draws DELAY_MS behind the host's clock", t, 1500 - DELAY_MS);
  const s = it.sample(4, t);
  check("position between two snapshots", r(s.pos[0]), r((t - 1000) / 50 * 0.25));
  check("velocity from the snapshots", r(s.vel[0]), 5);
  check("half-way between snapshots is half-way between positions", r(it.sample(4, 1125).pos[0], 3), 0.625);
  check("past the newest snapshot it keeps moving briefly", r(it.sample(4, 1600).pos[0]), r(2.5 + 0.5));
  check("…then stops rather than running off", [r(it.sample(4, 3000).pos[0]), it.sample(4, 3000).vel], [r(2.5 + 1.25), [0, 0, 0]]);
  check("before the first snapshot: the first position", it.sample(4, 0).pos[0], 0);
  check("unknown player → null", it.sample(9, t), null);

  it.push(900, [at(99)], now + 1); // an old packet arriving late
  check("late packets are ignored", r(it.sample(4, 1500).pos[0]), 2.5);
  // A packet delayed 200 ms extra must not drag the clock back.
  it.push(1550, [at(2.75)], 5030 + 550 + 200);
  check("slow packets barely move the clock", Math.abs(it.renderTime(now) - t) < 20, true);

  const turn = createInterpolator();
  turn.push(0, [{ ...at(0), yaw: 3.0 }], 0);
  turn.push(100, [{ ...at(0), yaw: -3.0 }], 100);
  check("yaw turns the short way across ±π", Math.abs(turn.sample(4, 50).yaw) > 3, true);

  check("active players are listed", it.ids(1500), [4]);
  check("…and dropped once stale", it.ids(1500 + 5000), []);
}
check("redundancy constant", CMD_REDUNDANCY, 3);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll net checks passed");
