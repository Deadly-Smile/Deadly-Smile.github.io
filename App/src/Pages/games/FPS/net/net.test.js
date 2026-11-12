// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the netcode: wire format, the host's simulation,
// guest prediction and interpolation, and all of them together over a
// simulated slow, lossy link. Run with:
//   node src/Pages/games/FPS/net/net.test.js
import {
  encodeCommands, decodeCommands, encodeSnapshot, decodeSnapshot, packKeys, unpackKeys, MAX_PLAYERS, CMD_REDUNDANCY,
} from "./protocol.js";
import { createHostSim, cleanName, HOST_ID } from "./hostSim.js";
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
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const seeded = (s = 99) => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ─── Wire format ─────────────────────────────────────────────────────────────
{
  const input = keys({ forward: true, jump: true, crouch: true });
  check("keys survive packing", unpackKeys(packKeys(input)), input);

  const cmds = [{ seq: 41, input: keys({ left: true }), yaw: 1.25, pitch: -0.5 }, { seq: 42, input: keys({ sprint: true, forward: true }), yaw: -3, pitch: 0.25 }];
  check("commands round-trip", decodeCommands(encodeCommands(cmds)), cmds);
  check("a command is 13 bytes", encodeCommands(cmds).byteLength, 2 + 2 * 13);
  check("garbage is rejected", [decodeCommands(new ArrayBuffer(5)), decodeCommands("hi"), decodeCommands(encodeSnapshot({ tick: 1, time: 1, ack: 0, self: { pos: [0, 0, 0], vel: [0, 0, 0], yaw: 0, pitch: 0 }, others: [] }))], [null, null, null]);
  const bad = encodeCommands(cmds);
  new DataView(bad).setFloat32(7, NaN);
  check("non-finite angles are rejected", decodeCommands(bad), null);

  const snap = {
    tick: 1234, time: 98765, ack: 77,
    self: { pos: [1.5, 0.25, -12.75], vel: [4.5, -2, 0.5], yaw: 0.5, pitch: -0.25, onGround: false, crouched: true },
    others: [
      { id: 3, pos: [-20.13, 1.2, 31.99], yaw: 2.5, pitch: 0.7, onGround: true, crouched: false },
      { id: 7, pos: [0, 0, 0], yaw: -3.1, pitch: -1.5, onGround: true, crouched: true },
    ],
  };
  const back = decodeSnapshot(encodeSnapshot(snap));
  check("snapshot header round-trips", [back.tick, back.time, back.ack], [1234, 98765, 77]);
  check("own state is exact", back.self, snap.self);
  const odd = { ...snap, self: { ...snap.self, pos: [0.1 + 0.2, 1 / 3, -Math.PI], vel: [1e-9, 2 / 3, 0] } };
  check("…to the last bit, for any position", [decodeSnapshot(encodeSnapshot(odd)).self.pos, decodeSnapshot(encodeSnapshot(odd)).self.vel], [odd.self.pos, odd.self.vel]);
  check("others: ids and flags", back.others.map(p => [p.id, p.onGround, p.crouched]), [[3, true, false], [7, true, true]]);
  check("others: positions to the centimetre", back.others[0].pos, [-20.13, 1.2, 31.99]);
  check("others: angles to well under a degree", back.others.every((p, i) => Math.abs(p.yaw - snap.others[i].yaw) < 0.001 && Math.abs(p.pitch - snap.others[i].pitch) < 0.01), true);
  check("7 other players fit in under 150 bytes", encodeSnapshot({ ...snap, others: Array(7).fill(snap.others[0]) }).byteLength < 150, true);
  check("a truncated snapshot is rejected", decodeSnapshot(encodeSnapshot(snap).slice(0, 60)), null);
}

// ─── Host simulation ─────────────────────────────────────────────────────────
const map = getMap("arena");
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
}
{
  const sim = createHostSim(map, "Host");
  const id = sim.add("guest");
  const start = [...sim.players.get(id).body.pos];
  const idle = { input: NONE, yaw: 0, pitch: 0 };
  const cmd = (seq) => ({ seq, input: keys({ forward: true }), yaw: 0, pitch: 0 });

  sim.receive(id, [cmd(1), cmd(2)]);
  sim.receive(id, [cmd(1), cmd(2), cmd(3)]); // the redundancy repeats 1 and 2
  check("repeated commands are queued once", sim.players.get(id).queue.length, 3);
  sim.tick(idle);
  sim.tick(idle);
  sim.tick(idle);
  check("applied in order and acknowledged", sim.snapshotFor(id, 3, 0).ack, 3);
  check("the guest moved", sim.players.get(id).body.pos[2] < start[2], true);

  // Speed hack: 300 commands at once are worth 5 s of movement — but the
  // host hands out one per tick.
  const p = sim.players.get(id);
  sim.receive(id, Array.from({ length: 300 }, (_, i) => cmd(4 + i)));
  check("a flood is trimmed to a second's worth", p.queue.length, 60);
  for (let i = 0; i < 10; i++) sim.tick(idle);
  check("…and applied at about one per tick", 60 - p.queue.length <= 10 + 8, true);

  check("a snapshot lists everyone else", sim.snapshotFor(id, 0, 0).others.map(o => o.id), [HOST_ID]);
  check("no snapshot for someone who left", sim.snapshotFor(5, 0, 0), null);
}

// ─── Prediction over a perfect link ──────────────────────────────────────────
{
  const sim = createHostSim(map, "Host");
  const id = sim.add("guest");
  const guest = createPredictor({ pos: [...sim.players.get(id).body.pos], yaw: 0 });
  const rand = seeded(5);
  let input = NONE;
  let yaw = 0;
  let worst = 0;
  for (let t = 0; t < 600; t++) {
    if (t % 15 === 0) {
      input = keys({ forward: rand() < 0.7, left: rand() < 0.3, right: rand() < 0.3, sprint: rand() < 0.4, crouch: rand() < 0.1 });
      yaw += (rand() - 0.5) * 1.5;
    }
    const packet = guest.step({ ...input, jump: rand() < 0.03 }, yaw, 0, map.boxes);
    sim.receive(id, decodeCommands(encodeCommands(packet)));
    sim.tick({ input: NONE, yaw: 0, pitch: 0 });
    if (t % 3 === 0) {
      const snap = decodeSnapshot(encodeSnapshot(sim.snapshotFor(id, t, t * 16.67)));
      worst = Math.max(worst, Math.hypot(...guest.reconcile(snap.self, snap.ack, map.boxes)));
    }
  }
  check("on a perfect link prediction never needs correcting (< 1 mm)", worst < 0.001, true);
  check("host and guest agree on where the guest is", dist(guest.body.pos, sim.players.get(id).body.pos) < 0.001, true);
}

// ─── Prediction over a slow, lossy link ──────────────────────────────────────
// 80 ms each way, 10% of packets lost in both directions.
{
  const sim = createHostSim(map, "Host");
  const id = sim.add("guest");
  const guest = createPredictor({ pos: [...sim.players.get(id).body.pos], yaw: 0 });
  const rand = seeded(17);
  const LAG = 5; // ticks ≈ 83 ms
  const up = [];   // [arrivalTick, buffer]
  const down = [];
  let input = NONE;
  let yaw = 0;
  let worst = 0;
  let corrections = 0;
  const run = (ticks, moving) => {
    for (let n = 0; n < ticks; n++) {
      const t = sim.tickCount = (sim.tickCount ?? 0) + 1;
      if (moving && t % 20 === 0) {
        input = keys({ forward: rand() < 0.8, left: rand() < 0.3, right: rand() < 0.3, sprint: rand() < 0.5 });
        yaw += (rand() - 0.5) * 2;
      }
      const packet = guest.step(moving ? { ...input, jump: rand() < 0.02 } : NONE, yaw, 0, map.boxes);
      if (rand() > 0.1) up.push([t + LAG, encodeCommands(packet)]);
      while (up.length && up[0][0] <= t) sim.receive(id, decodeCommands(up.shift()[1]));
      sim.tick({ input: NONE, yaw: 0, pitch: 0 });
      if (t % 3 === 0 && rand() > 0.1) down.push([t + LAG, encodeSnapshot(sim.snapshotFor(id, t, t * 16.67))]);
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
  check("once the link settles, guest and host agree exactly", dist(guest.body.pos, sim.players.get(id).body.pos) < 0.001, true);
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
