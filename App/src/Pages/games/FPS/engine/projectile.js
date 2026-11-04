// ─── Thrown grenades ────────────────────────────────────────────────────────
// A small point-like box that flies under gravity, bounces off map boxes and
// the floor (losing energy each time), rolls to a stop, and goes off when its
// fuse runs out. Moved one axis at a time like bodies are, so it can't pass
// through walls. Pure; mutates in place.
import { boxesOverlap } from "./geometry.js";
import { GRAVITY } from "./player.js";

export const GRENADE_RADIUS = 0.08;
const RESTITUTION = 0.4;      // fraction of speed kept off a bounce
const GROUND_FRICTION = 4;    // horizontal slow-down while resting on something (1/s)
const REST_SPEED = 0.3;

// Thrown from `origin` along the unit direction `dir`, inheriting the
// thrower's velocity.
export function createGrenade(origin, dir, speed, fuse, inherit = [0, 0, 0]) {
  return {
    pos: [...origin],
    prev: [...origin],
    vel: [dir[0] * speed + inherit[0], dir[1] * speed + inherit[1], dir[2] * speed + inherit[2]],
    fuse,
    resting: false,
  };
}

const boxAt = (p) => ({
  min: [p[0] - GRENADE_RADIUS, p[1] - GRENADE_RADIUS, p[2] - GRENADE_RADIUS],
  max: [p[0] + GRENADE_RADIUS, p[1] + GRENADE_RADIUS, p[2] + GRENADE_RADIUS],
});

function moveAxis(g, axis, delta, boxes) {
  if (!delta) return false;
  g.pos[axis] += delta;
  if (axis === 1 && g.pos[1] < GRENADE_RADIUS) {
    g.pos[1] = GRENADE_RADIUS;
    return true;
  }
  const self = boxAt(g.pos);
  const hits = boxes.filter(b => boxesOverlap(self, b));
  if (!hits.length) return false;
  g.pos[axis] = delta > 0
    ? Math.min(...hits.map(b => b.min[axis])) - GRENADE_RADIUS
    : Math.max(...hits.map(b => b.max[axis])) + GRENADE_RADIUS;
  return true;
}

// One tick. Returns true when the fuse runs out (the caller explodes it).
export function stepGrenade(g, dt, boxes) {
  g.prev[0] = g.pos[0];
  g.prev[1] = g.pos[1];
  g.prev[2] = g.pos[2];
  g.fuse -= dt;
  if (g.fuse <= 1e-9) return true;
  if (g.resting) return false;

  g.vel[1] -= GRAVITY * dt;
  for (const axis of [0, 2, 1]) {
    if (moveAxis(g, axis, g.vel[axis] * dt, boxes)) g.vel[axis] = -g.vel[axis] * RESTITUTION;
  }

  // Sitting on something (floor or a box top within a few mm): friction,
  // and stop bouncing once it's slow.
  const below = boxAt([g.pos[0], g.pos[1] - 0.005, g.pos[2]]);
  const support = g.pos[1] <= GRENADE_RADIUS + 1e-6 ? 0
    : Math.max(-1, ...boxes.filter(b => boxesOverlap(below, b) && b.max[1] <= g.pos[1]).map(b => b.max[1]));
  if (support >= 0 && Math.abs(g.vel[1]) < 1) {
    g.pos[1] = support + GRENADE_RADIUS;
    g.vel[1] = 0;
    const k = Math.max(0, 1 - GROUND_FRICTION * dt);
    g.vel[0] *= k;
    g.vel[2] *= k;
    if (Math.hypot(g.vel[0], g.vel[2]) < REST_SPEED) {
      g.vel = [0, 0, 0];
      g.resting = true;
    }
  }
  return false;
}
