// ─── Pathfinding over the nav grid ──────────────────────────────────────────
// A* from one nav node to another (straight-line heuristic, binary heap),
// then a light smoothing pass so bots walk straight across open ground
// instead of following the grid's 45° zig-zags. Pure.
import { lineOfSight, BODY_RADIUS } from "./geometry.js";

const SMOOTH_AHEAD = 12;

function heapPush(heap, item) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p][0] <= heap[i][0]) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}

const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 2, a.z - b.z);

// Node indices from `start` to `goal` inclusive, or null if unreachable.
// `maxExpanded` caps the work for a single request.
export function findPath(nav, start, goal, maxExpanded = 20000) {
  if (start < 0 || goal < 0) return null;
  if (nav.nodes[start].component !== nav.nodes[goal].component) return null;
  if (start === goal) return [start];
  const g = new Map([[start, 0]]);
  const from = new Map();
  const closed = new Set();
  const heap = [[dist(nav.nodes[start], nav.nodes[goal]), start]];
  let expanded = 0;
  while (heap.length && expanded < maxExpanded) {
    const [, cur] = heapPop(heap);
    if (cur === goal) {
      const path = [cur];
      let k = cur;
      while (from.has(k)) path.push(k = from.get(k));
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    expanded++;
    const gc = g.get(cur);
    for (const nb of nav.neighbors[cur]) {
      if (closed.has(nb)) continue;
      const cost = gc + dist(nav.nodes[cur], nav.nodes[nb]);
      if (cost < (g.get(nb) ?? Infinity)) {
        g.set(nb, cost);
        from.set(nb, cur);
        heapPush(heap, [cost + dist(nav.nodes[nb], nav.nodes[goal]), nb]);
      }
    }
  }
  return null;
}

// Drops intermediate nodes where a body could walk straight from an earlier
// node to a later one: same floor height all the way, and nothing in the way
// at knee and chest height on both sides of the body. Stairs and ledges keep
// every node, so steps are still climbed one at a time.
export function smoothPath(nav, path, boxes) {
  if (!path || path.length < 3) return path;
  const N = nav.nodes;
  const clear = (a, b) => {
    if (a.y !== b.y) return false;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    // Offsets to the body's sides, perpendicular to the walk.
    const ox = (-dz / len) * BODY_RADIUS;
    const oz = (dx / len) * BODY_RADIUS;
    for (const h of [0.5, 1.2]) {
      for (const s of [-1, 0, 1]) {
        if (!lineOfSight([a.x + ox * s, a.y + h, a.z + oz * s], [b.x + ox * s, b.y + h, b.z + oz * s], boxes)) return false;
      }
    }
    return true;
  };
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    // Look at most SMOOTH_AHEAD nodes ahead: keeps repaths cheap on long paths.
    let j = Math.min(path.length - 1, i + SMOOTH_AHEAD);
    while (j > i + 1) {
      let flat = true;
      for (let k = i + 1; k <= j && flat; k++) flat = N[path[k]].y === N[path[i]].y;
      if (flat && clear(N[path[i]], N[path[j]])) break;
      j--;
    }
    out.push(path[j]);
    i = j;
  }
  return out;
}
