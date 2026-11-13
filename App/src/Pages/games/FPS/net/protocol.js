// ─── Wire format ────────────────────────────────────────────────────────────
// The two high-rate messages, packed into small binary buffers:
//
//   commands  (guest → host, every tick)   what the player pressed (movement
//             and weapon), where they look, and the moment in the host's
//             time they were looking at — one per simulation tick, numbered.
//             Each packet repeats the last few, so one lost packet loses
//             nothing. A guest never says "I shot X": the host works out
//             every shot from these inputs.
//   snapshot  (host → each guest, 20 Hz)   the recipient's own exact state
//             (body, health, weapons) plus the number of their last command
//             the host has applied (for prediction), every other player
//             quantised small, and the grenades in flight.
//
// Everything else (joining, kills, pickups, chat…) is rare and goes as JSON
// on the reliable channel; see room.js. Pure: ArrayBuffer/DataView only.

export const MAX_PLAYERS = 8;
export const SNAPSHOT_HZ = 20;
// Commands repeated per packet.
export const CMD_REDUNDANCY = 3;
// Weapon ids as small numbers on the wire.
export const WEAPON_IDS = ["smg", "rifle", "sniper", "shotgun", "pistol", "knife", "grenade"];

const TYPE_CMD = 1;
const TYPE_SNAPSHOT = 2;
const KEYS = ["forward", "back", "left", "right", "jump", "sprint", "crouch", "ads"];
const CMD_BYTES = 19;   // seq u32, keys u8, weapon keys u8, scroll i8, yaw f32, pitch f32, view u32
const HEADER_BYTES = 16;
const SELF_BYTES = 111;
const OTHER_BYTES = 13; // id u8, flags u8, pos 3×i16 (cm), yaw i16, pitch i8, weapon u8, shots u8
const GRENADE_BYTES = 6;
const FLAG_GROUND = 1;
const FLAG_CROUCH = 2;
const FLAG_DEAD = 4;
const TAU = Math.PI * 2;

export function packKeys(input) {
  let bits = 0;
  KEYS.forEach((k, i) => { if (input[k]) bits |= 1 << i; });
  return bits;
}

export function unpackKeys(bits) {
  const input = {};
  KEYS.forEach((k, i) => { input[k] = !!(bits & (1 << i)); });
  return input;
}

// The weapon half of a command: { fire, reload, lastWeapon, slot (0-3 or
// null), scroll (-1/0/1) } plus `use` (pick up). Aiming rides in the keys.
const packWeapon = (w, use) => (w.fire ? 1 : 0) | (w.reload ? 2 : 0) | (w.lastWeapon ? 4 : 0) | (use ? 8 : 0)
  | ((w.slot == null ? 0 : w.slot + 1) << 4);

// cmds: [{ seq, input, weapon, use, yaw, pitch, view }], oldest first.
export function encodeCommands(cmds) {
  const buf = new ArrayBuffer(2 + cmds.length * CMD_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, TYPE_CMD);
  v.setUint8(1, cmds.length);
  cmds.forEach((c, i) => {
    const o = 2 + i * CMD_BYTES;
    v.setUint32(o, c.seq);
    v.setUint8(o + 4, packKeys(c.input));
    v.setUint8(o + 5, packWeapon(c.weapon, c.use));
    v.setInt8(o + 6, Math.sign(c.weapon.scroll || 0));
    v.setFloat32(o + 7, c.yaw);
    v.setFloat32(o + 11, c.pitch);
    v.setUint32(o + 15, Math.max(0, Math.round(c.view)));
  });
  return buf;
}

// → the commands, or null if the buffer isn't a well-formed command packet
// (the host never trusts what arrives).
export function decodeCommands(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 2) return null;
  const v = new DataView(buf);
  const n = v.getUint8(1);
  if (v.getUint8(0) !== TYPE_CMD || n > 16 || buf.byteLength !== 2 + n * CMD_BYTES) return null;
  const cmds = [];
  for (let i = 0; i < n; i++) {
    const o = 2 + i * CMD_BYTES;
    const yaw = v.getFloat32(o + 7);
    const pitch = v.getFloat32(o + 11);
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
    const input = unpackKeys(v.getUint8(o + 4));
    const w = v.getUint8(o + 5);
    const slot = (w >> 4) & 7;
    cmds.push({
      seq: v.getUint32(o),
      input,
      weapon: {
        fire: !!(w & 1), ads: input.ads, reload: !!(w & 2), lastWeapon: !!(w & 4),
        slot: slot >= 1 && slot <= 4 ? slot - 1 : null,
        scroll: Math.sign(v.getInt8(o + 6)),
      },
      use: !!(w & 8),
      yaw,
      pitch,
      view: v.getUint32(o + 15),
    });
  }
  return cmds;
}

const flagsOf = (p) => (p.onGround ? FLAG_GROUND : 0) | (p.crouched ? FLAG_CROUCH : 0) | (p.dead ? FLAG_DEAD : 0);
const wrapAngle = (a) => a - TAU * Math.floor((a + Math.PI) / TAU); // → [-π, π)
const weaponIndex = (id) => Math.max(0, WEAPON_IDS.indexOf(id));

// A cursor over a DataView, so fields are written and read in one order.
function cursor(view, at) {
  let o = at;
  const step = (n) => { const was = o; o += n; return was; };
  return {
    get at() { return o; },
    u8: (x) => view.setUint8(step(1), x), ru8: () => view.getUint8(step(1)),
    i8: (x) => view.setInt8(step(1), x), ri8: () => view.getInt8(step(1)),
    u16: (x) => view.setUint16(step(2), x), ru16: () => view.getUint16(step(2)),
    i16: (x) => view.setInt16(step(2), x), ri16: () => view.getInt16(step(2)),
    f32: (x) => view.setFloat32(step(4), x), rf32: () => view.getFloat32(step(4)),
    f64: (x) => view.setFloat64(step(8), x), rf64: () => view.getFloat64(step(8)),
  };
}
const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));

// snapshot: { tick, time (ms, host clock), ack, gen (map generation, u8),
//             self, others, grenades }
//   self:   { pos, vel, yaw, pitch, onGround, crouched, dead, hp, respawnIn,
//             loadout }                                   exact
//           loadout: { primary, active, previous, ammo: { primary: [mag,
//             reserve], pistol: [mag, reserve], grenades }, cooldown,
//             reloading, switching, bloom, recoilDebt, triggerHeld, ads }
//   others: [{ id, pos, yaw, pitch, onGround, crouched, dead, weapon,
//             shots }]                                    quantised
//   grenades: [[x, y, z]]
// The recipient's own position, velocity and weapon timers go as float64:
// prediction replays from them, and a body resting flush against a wall must
// not be nudged into it by rounding (which changes how the next step
// collides), nor a shot land a tick early.
// Should a guest use this snapshot? Not if it is older than the newest one
// used (the state channel is unordered), nor if it belongs to a map other
// than the one loaded (`gen`; the roster that announces a map change travels
// on the other channel, so either may arrive first).
export const snapshotWanted = (snap, gen, latestTick = null) =>
  !!snap && snap.gen === gen && (latestTick === null || snap.tick > latestTick);

export function encodeSnapshot({ tick, time, ack, gen = 0, self, others, grenades = [] }) {
  const buf = new ArrayBuffer(HEADER_BYTES + SELF_BYTES + others.length * OTHER_BYTES + grenades.length * GRENADE_BYTES);
  const v = new DataView(buf);
  const c = cursor(v, 0);
  c.u8(TYPE_SNAPSHOT); c.u8(others.length); c.u8(grenades.length); c.u8(gen & 255);
  v.setUint32(4, tick); v.setUint32(8, Math.round(time)); v.setUint32(12, ack);
  const s = cursor(v, HEADER_BYTES);
  for (const x of self.pos) s.f64(x);
  for (const x of self.vel) s.f64(x);
  s.f32(self.yaw); s.f32(self.pitch);
  s.u8(flagsOf(self));
  s.u8(clampInt(Math.ceil(self.hp), 0, 255));
  s.u8(clampInt(self.respawnIn * 10, 0, 255));
  const l = self.loadout;
  s.u8(weaponIndex(l.primary)); s.u8(l.active); s.u8(l.previous);
  s.u8(l.ammo.primary[0]); s.u16(l.ammo.primary[1]);
  s.u8(l.ammo.pistol[0]); s.u16(l.ammo.pistol[1]);
  s.u8(l.ammo.grenades);
  s.f64(l.cooldown); s.f64(l.reloading); s.f64(l.switching); s.f64(l.bloom); s.f64(l.recoilDebt);
  s.u8((l.triggerHeld ? 1 : 0) | (l.ads ? 2 : 0));
  const o = cursor(v, HEADER_BYTES + SELF_BYTES);
  for (const p of others) {
    o.u8(p.id); o.u8(flagsOf(p));
    for (const x of p.pos) o.i16(clampInt(x * 100, -32768, 32767));
    o.i16(Math.round((wrapAngle(p.yaw) / Math.PI) * 32767));
    o.i8(clampInt((p.pitch / (Math.PI / 2)) * 127, -127, 127));
    o.u8(weaponIndex(p.weapon)); o.u8(p.shots & 255);
  }
  for (const g of grenades) for (const x of g) o.i16(clampInt(x * 100, -32768, 32767));
  return buf;
}

export function decodeSnapshot(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < HEADER_BYTES + SELF_BYTES) return null;
  const v = new DataView(buf);
  const n = v.getUint8(1);
  const ng = v.getUint8(2);
  if (v.getUint8(0) !== TYPE_SNAPSHOT || buf.byteLength !== HEADER_BYTES + SELF_BYTES + n * OTHER_BYTES + ng * GRENADE_BYTES) return null;
  const s = cursor(v, HEADER_BYTES);
  const f3 = () => [s.rf64(), s.rf64(), s.rf64()];
  const self = { pos: f3(), vel: f3(), yaw: s.rf32(), pitch: s.rf32() };
  const flags = s.ru8();
  Object.assign(self, { onGround: !!(flags & FLAG_GROUND), crouched: !!(flags & FLAG_CROUCH), dead: !!(flags & FLAG_DEAD) });
  self.hp = s.ru8();
  self.respawnIn = s.ru8() / 10;
  const l = { primary: WEAPON_IDS[s.ru8()] ?? "rifle", active: s.ru8() & 3, previous: s.ru8() & 3 };
  l.ammo = { primary: [s.ru8(), s.ru16()], pistol: [s.ru8(), s.ru16()], grenades: s.ru8() };
  Object.assign(l, { cooldown: s.rf64(), reloading: s.rf64(), switching: s.rf64(), bloom: s.rf64(), recoilDebt: s.rf64() });
  const lf = s.ru8();
  l.triggerHeld = !!(lf & 1);
  l.ads = !!(lf & 2);
  self.loadout = l;

  const o = cursor(v, HEADER_BYTES + SELF_BYTES);
  const others = [];
  for (let i = 0; i < n; i++) {
    const id = o.ru8();
    const f = o.ru8();
    others.push({
      id,
      pos: [o.ri16() / 100, o.ri16() / 100, o.ri16() / 100],
      yaw: (o.ri16() / 32767) * Math.PI,
      pitch: (o.ri8() / 127) * (Math.PI / 2),
      onGround: !!(f & FLAG_GROUND), crouched: !!(f & FLAG_CROUCH), dead: !!(f & FLAG_DEAD),
      weapon: WEAPON_IDS[o.ru8()] ?? "rifle",
      shots: o.ru8(),
    });
  }
  const grenades = [];
  for (let i = 0; i < ng; i++) grenades.push([o.ri16() / 100, o.ri16() / 100, o.ri16() / 100]);
  return { tick: v.getUint32(4), time: v.getUint32(8), ack: v.getUint32(12), gen: v.getUint8(3), self, others, grenades };
}
