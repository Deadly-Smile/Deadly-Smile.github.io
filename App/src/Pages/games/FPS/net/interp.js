// ─── Showing other players smoothly ─────────────────────────────────────────
// Snapshots arrive 20 times a second and unevenly. Drawing other players at
// the newest one would make them jerk; instead they are drawn a little in the
// past (DELAY_MS), always between two snapshots that have already arrived,
// and moved smoothly from one to the other.
// Pure: no PeerJS/DOM; times are passed in.

export const DELAY_MS = 100;
const KEEP_MS = 1000;      // history kept per player
const STALE_MS = 2000;     // a player with nothing newer than this is gone
const HOLD_MS = 250;       // past the newest snapshot: keep moving this long, then stop

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export function createInterpolator(delay = DELAY_MS) {
  const tracks = new Map(); // id → [{ t, pos, yaw, pitch, onGround, crouched }] oldest first
  let offset = null;        // host clock − local clock (ms), as best we can tell

  return {
    // A snapshot stamped `time` (host ms) that arrived at `localNow` (ms).
    push(time, others, localNow) {
      // The smallest lag seen is the truest clock offset: snap to a packet
      // that arrived quicker, drift slowly toward slower ones.
      const o = time - localNow;
      offset = offset === null || o > offset ? o : offset + (o - offset) * 0.02;
      for (const p of others) {
        let track = tracks.get(p.id);
        if (!track) tracks.set(p.id, track = []);
        if (track.length && time <= track[track.length - 1].t) continue; // late or duplicate
        track.push({ t: time, ...p });
        while (track.length > 2 && track[0].t < time - KEEP_MS) track.shift();
      }
    },
    // The host time to draw at, for a local time.
    renderTime: (localNow) => (offset === null ? null : localNow + offset - delay),
    // Players with recent data.
    ids(t) {
      const out = [];
      for (const [id, track] of tracks) {
        if (track[track.length - 1].t >= t - STALE_MS) out.push(id);
        else tracks.delete(id);
      }
      return out;
    },
    forget: (id) => tracks.delete(id),
    // Forget everyone (the map changed: old positions mean nothing now).
    clear: () => tracks.clear(),
    // Player `id` at host time `t` → { pos, vel, yaw, pitch, onGround, crouched } or null.
    sample(id, t) {
      const track = tracks.get(id);
      if (!track?.length) return null;
      let i = track.length - 1;
      while (i > 0 && track[i - 1].t >= t) i--;
      const b = track[i];
      const a = track[i - 1];
      if (!a || t <= a.t) return { ...(a ?? b), vel: [0, 0, 0] };
      const span = b.t - a.t;
      const vel = a.pos.map((v, k) => ((b.pos[k] - v) / span) * 1000);
      if (t >= b.t) {
        // Nothing newer yet: carry on along the last movement briefly.
        const ahead = Math.min(t - b.t, HOLD_MS) / 1000;
        const moving = t - b.t < HOLD_MS;
        return { ...b, pos: b.pos.map((v, k) => v + vel[k] * ahead), vel: moving ? vel : [0, 0, 0] };
      }
      const k = (t - a.t) / span;
      return {
        ...b,
        pos: a.pos.map((v, n) => lerp(v, b.pos[n], k)),
        vel,
        yaw: lerpAngle(a.yaw, b.yaw, k),
        pitch: lerp(a.pitch, b.pitch, k),
        onGround: b.onGround,
        crouched: b.crouched,
      };
    },
  };
}
