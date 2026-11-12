// ─── Wire format ────────────────────────────────────────────────────────────
// The two high-rate messages, packed into small binary buffers:
//
//   commands  (guest → host, every tick)   what the player pressed and where
//             they look, one per simulation tick, numbered. Each packet
//             repeats the last few, so one lost packet loses nothing.
//   snapshot  (host → each guest, 20 Hz)   the recipient's own exact state
//             plus the number of their last command the host has applied
//             (for prediction), and every other player quantised small.
//
// Everything else (joining, leaving, chat…) is rare and goes as JSON on the
// reliable channel; see room.js. Pure: ArrayBuffer/DataView only.

export const MAX_PLAYERS = 8;
export const SNAPSHOT_HZ = 20;
// Commands repeated per packet.
export const CMD_REDUNDANCY = 3;

const TYPE_CMD = 1;
const TYPE_SNAPSHOT = 2;
const KEYS = ["forward", "back", "left", "right", "jump", "sprint", "crouch", "ads"];
const CMD_BYTES = 13;      // seq u32, keys u8, yaw f32, pitch f32
// The recipient's own position and velocity go as float64: prediction replays
// from them, and a body resting flush against a wall must not be nudged into
// it by rounding (which changes how the next step collides).
const SELF_BYTES = 58;     // pos 3×f64, vel 3×f64, yaw f32, pitch f32, flags u8, pad
const OTHER_BYTES = 11;    // id u8, flags u8, pos 3×i16 (cm), yaw i16, pitch i8
const FLAG_GROUND = 1;
const FLAG_CROUCH = 2;
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

// cmds: [{ seq, input, yaw, pitch }], oldest first.
export function encodeCommands(cmds) {
  const buf = new ArrayBuffer(2 + cmds.length * CMD_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, TYPE_CMD);
  v.setUint8(1, cmds.length);
  cmds.forEach((c, i) => {
    const o = 2 + i * CMD_BYTES;
    v.setUint32(o, c.seq);
    v.setUint8(o + 4, packKeys(c.input));
    v.setFloat32(o + 5, c.yaw);
    v.setFloat32(o + 9, c.pitch);
  });
  return buf;
}

// → [{ seq, input, yaw, pitch }] or null if the buffer isn't a well-formed
// command packet (the host never trusts what arrives).
export function decodeCommands(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 2) return null;
  const v = new DataView(buf);
  const n = v.getUint8(1);
  if (v.getUint8(0) !== TYPE_CMD || n > 16 || buf.byteLength !== 2 + n * CMD_BYTES) return null;
  const cmds = [];
  for (let i = 0; i < n; i++) {
    const o = 2 + i * CMD_BYTES;
    const yaw = v.getFloat32(o + 5);
    const pitch = v.getFloat32(o + 9);
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
    cmds.push({ seq: v.getUint32(o), input: unpackKeys(v.getUint8(o + 4)), yaw, pitch });
  }
  return cmds;
}

const flagsOf = (p) => (p.onGround ? FLAG_GROUND : 0) | (p.crouched ? FLAG_CROUCH : 0);
const wrapAngle = (a) => a - TAU * Math.floor((a + Math.PI) / TAU); // → [-π, π)

// snapshot: { tick, time (ms, host clock), ack, self, others }
//   self:   { pos, vel, yaw, pitch, onGround, crouched }   exact
//   others: [{ id, pos, yaw, pitch, onGround, crouched }]  quantised
export function encodeSnapshot({ tick, time, ack, self, others }) {
  const buf = new ArrayBuffer(14 + SELF_BYTES + others.length * OTHER_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, TYPE_SNAPSHOT);
  v.setUint8(1, others.length);
  v.setUint32(2, tick);
  v.setUint32(6, Math.round(time));
  v.setUint32(10, ack);
  let o = 14;
  for (let i = 0; i < 3; i++) v.setFloat64(o + i * 8, self.pos[i]);
  for (let i = 0; i < 3; i++) v.setFloat64(o + 24 + i * 8, self.vel[i]);
  v.setFloat32(o + 48, self.yaw);
  v.setFloat32(o + 52, self.pitch);
  v.setUint8(o + 56, flagsOf(self));
  o += SELF_BYTES;
  for (const p of others) {
    v.setUint8(o, p.id);
    v.setUint8(o + 1, flagsOf(p));
    for (let i = 0; i < 3; i++) v.setInt16(o + 2 + i * 2, Math.round(p.pos[i] * 100));
    v.setInt16(o + 8, Math.round((wrapAngle(p.yaw) / Math.PI) * 32767));
    v.setInt8(o + 10, Math.round((p.pitch / (Math.PI / 2)) * 127));
    o += OTHER_BYTES;
  }
  return buf;
}

export function decodeSnapshot(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 14 + SELF_BYTES) return null;
  const v = new DataView(buf);
  const n = v.getUint8(1);
  if (v.getUint8(0) !== TYPE_SNAPSHOT || buf.byteLength !== 14 + SELF_BYTES + n * OTHER_BYTES) return null;
  let o = 14;
  const f3 = (at) => [v.getFloat64(at), v.getFloat64(at + 8), v.getFloat64(at + 16)];
  const selfFlags = v.getUint8(o + 56);
  const self = {
    pos: f3(o), vel: f3(o + 24), yaw: v.getFloat32(o + 48), pitch: v.getFloat32(o + 52),
    onGround: !!(selfFlags & FLAG_GROUND), crouched: !!(selfFlags & FLAG_CROUCH),
  };
  o += SELF_BYTES;
  const others = [];
  for (let i = 0; i < n; i++) {
    const flags = v.getUint8(o + 1);
    others.push({
      id: v.getUint8(o),
      pos: [v.getInt16(o + 2) / 100, v.getInt16(o + 4) / 100, v.getInt16(o + 6) / 100],
      yaw: (v.getInt16(o + 8) / 32767) * Math.PI,
      pitch: (v.getInt8(o + 10) / 127) * (Math.PI / 2),
      onGround: !!(flags & FLAG_GROUND), crouched: !!(flags & FLAG_CROUCH),
    });
    o += OTHER_BYTES;
  }
  return { tick: v.getUint32(2), time: v.getUint32(6), ack: v.getUint32(10), self, others };
}
