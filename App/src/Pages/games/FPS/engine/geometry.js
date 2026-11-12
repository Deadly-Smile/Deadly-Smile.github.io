// ─── Axis-aligned box geometry ──────────────────────────────────────────────
// Maps are built only from axis-aligned boxes ({ min: [x,y,z], max: [x,y,z] }),
// and a body is approximated by an upright box too, so everything collision,
// line-of-sight and hitscan need reduces to box/box and segment/box tests.
// Pure: no three.js, runs in Node.

// Body dimensions shared by players and bots (metres).
export const BODY_RADIUS = 0.4;
export const BODY_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.6;
// Highest ledge a body walks up without jumping (stairs are built from it).
export const STEP_HEIGHT = 0.45;

const EPS = 1e-6;

export function boxesOverlap(a, b) {
  return a.min[0] < b.max[0] - EPS && a.max[0] > b.min[0] + EPS
    && a.min[1] < b.max[1] - EPS && a.max[1] > b.min[1] + EPS
    && a.min[2] < b.max[2] - EPS && a.max[2] > b.min[2] + EPS;
}

// The box a body occupies when standing with its feet at `pos`. `lift`
// raises the bottom (e.g. STEP_HEIGHT, so low ledges under the feet don't count).
export function bodyBox(pos, { radius = BODY_RADIUS, height = BODY_HEIGHT, lift = 0 } = {}) {
  return {
    min: [pos[0] - radius, pos[1] + lift, pos[2] - radius],
    max: [pos[0] + radius, pos[1] + height, pos[2] + radius],
  };
}

export function overlapsAny(box, boxes) {
  return boxes.some(b => boxesOverlap(box, b));
}

// Slab test. Returns the fraction t ∈ [0, 1] along p0→p1 where the segment
// first enters `box`, or null if it misses. A segment starting inside the box
// hits at t = 0.
export function segmentHitsBox(p0, p1, box) {
  let tMin = 0;
  let tMax = 1;
  for (let i = 0; i < 3; i++) {
    const d = p1[i] - p0[i];
    if (Math.abs(d) < EPS) {
      if (p0[i] < box.min[i] || p0[i] > box.max[i]) return null;
      continue;
    }
    let t1 = (box.min[i] - p0[i]) / d;
    let t2 = (box.max[i] - p0[i]) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }
  return tMin;
}

// Nearest hit of the segment p0→p1 against `boxes`: { t, index } or null.
export function raycastBoxes(p0, p1, boxes) {
  let best = null;
  for (let i = 0; i < boxes.length; i++) {
    const t = segmentHitsBox(p0, p1, boxes[i]);
    if (t !== null && (best === null || t < best.t)) best = { t, index: i };
  }
  return best;
}

export function lineOfSight(p0, p1, boxes) {
  return raycastBoxes(p0, p1, boxes) === null;
}

// Height of the walkable surface at (x, z): the highest box top whose
// footprint contains the point, or 0 (the floor). Maps have no overhangs or
// second storeys, so there is only ever one surface per (x, z).
export function groundHeightAt(x, z, boxes) {
  let y = 0;
  for (const b of boxes) {
    if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] > y) y = b.max[1];
  }
  return y;
}

// Ray against the map: its boxes plus the floor plane (y = 0). Returns
// { t, point, normal, index } for the nearest hit (index -1 = the floor), or
// null. `normal` is the face hit, for orienting bullet holes and bounces.
export function raycastWorld(p0, p1, boxes) {
  const best = raycastBoxes(p0, p1, boxes);
  let index = best ? best.index : -1;
  let t = best ? best.t : Infinity;
  if (p1[1] < 0 && p0[1] >= 0) {
    const tf = p0[1] / (p0[1] - p1[1]);
    if (tf < t) {
      t = tf;
      index = -1;
    }
  }
  if (t === Infinity) return null;
  const point = [0, 1, 2].map(i => p0[i] + (p1[i] - p0[i]) * t);
  const normal = index === -1 ? [0, 1, 0] : boxFaceNormal(point, boxes[index], p0);
  return { t, point, normal, index };
}

// Which face of `box` the point lies on: the axis where the point is closest
// to a face, pointing back toward `from` (the ray origin).
export function boxFaceNormal(point, box, from) {
  let axis = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 3; i++) {
    const d = Math.min(Math.abs(point[i] - box.min[i]), Math.abs(point[i] - box.max[i]));
    if (d < bestDist) {
      bestDist = d;
      axis = i;
    }
  }
  const normal = [0, 0, 0];
  normal[axis] = from[axis] < point[axis] ? -1 : 1;
  return normal;
}
