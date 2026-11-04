// ─── Navigation grid ────────────────────────────────────────────────────────
// Instead of hand-placed waypoints (which silently break whenever a box is
// moved), each map's nav graph is generated from its boxes at load time: one
// node per SPACING-metre cell where a body can stand, linked to its 8
// neighbours when it can walk between them (no wall in the way, height change
// no more than a step). Bots path-find over this graph (FPS-6).
// Pure: no three.js, runs in Node.
import { bodyBox, groundHeightAt, overlapsAny, lineOfSight, STEP_HEIGHT, BODY_HEIGHT, BODY_RADIUS } from "./geometry.js";

export const SPACING = 1;
// A node with an obstacle at least COVER_HEIGHT tall (above the node's floor)
// within COVER_REACH in some direction is cover — a bot crouched there is
// hidden from that side.
export const COVER_HEIGHT = 1.0;
export const COVER_REACH = 1.5;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function buildNavGraph(map, spacing = SPACING) {
  const [w, d] = map.size;
  const cols = Math.floor(w / spacing);
  const rows = Math.floor(d / spacing);
  const originX = -w / 2 + spacing / 2;
  const originZ = -d / 2 + spacing / 2;
  const boxes = map.boxes;

  // Cell → node index, -1 where nothing can stand.
  const index = new Int32Array(cols * rows).fill(-1);
  const nodes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = originX + c * spacing;
      const z = originZ + r * spacing;
      const y = groundHeightAt(x, z, boxes);
      // Lifted by a step: a low ledge right next to the feet doesn't block.
      if (overlapsAny(bodyBox([x, y, z], { lift: STEP_HEIGHT }), boxes)) continue;
      index[r * cols + c] = nodes.length;
      nodes.push({ x, y, z, col: c, row: r, cover: false, component: -1 });
    }
  }

  const neighbors = nodes.map(() => []);
  const cellNode = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? -1 : index[r * cols + c]);
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (const [dc, dr] of DIRS) {
      const j = cellNode(a.col + dc, a.row + dr);
      if (j < i) continue; // each pair once (and -1)
      const b = nodes[j];
      if (Math.abs(a.y - b.y) > STEP_HEIGHT) continue;
      // No cutting corners past a wall on a diagonal.
      if (dc && dr && (cellNode(a.col + dc, a.row) < 0 || cellNode(a.col, a.row + dr) < 0)) continue;
      // The volume swept between the two cells must be clear too.
      const swept = {
        min: [Math.min(a.x, b.x) - BODY_RADIUS, Math.min(a.y, b.y) + STEP_HEIGHT, Math.min(a.z, b.z) - BODY_RADIUS],
        max: [Math.max(a.x, b.x) + BODY_RADIUS, Math.max(a.y, b.y) + BODY_HEIGHT, Math.max(a.z, b.z) + BODY_RADIUS],
      };
      if (overlapsAny(swept, boxes)) continue;
      neighbors[i].push(j);
      neighbors[j].push(i);
    }
  }

  for (const n of nodes) {
    const h = n.y + COVER_HEIGHT - 0.05;
    n.cover = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) =>
      !lineOfSight([n.x, h, n.z], [n.x + dx * COVER_REACH, h, n.z + dz * COVER_REACH], boxes));
  }

  // Connected components; the largest is "the map" — anything else (the top
  // of a container nobody can climb) is unreachable on foot.
  const sizes = [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].component !== -1) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [i];
    nodes[i].component = id;
    while (stack.length) {
      const k = stack.pop();
      size++;
      for (const m of neighbors[k]) {
        if (nodes[m].component === -1) {
          nodes[m].component = id;
          stack.push(m);
        }
      }
    }
    sizes.push(size);
  }
  const mainComponent = sizes.indexOf(Math.max(0, ...sizes));

  return { spacing, cols, rows, originX, originZ, index, nodes, neighbors, mainComponent };
}

// Nearest node to a world position (searching a few cells out from the
// position's own cell), preferring nodes at a similar height. -1 if none.
export function nearestNode(nav, pos, maxRing = 3) {
  const c0 = Math.round((pos[0] - nav.originX) / nav.spacing);
  const r0 = Math.round((pos[2] - nav.originZ) / nav.spacing);
  let best = -1;
  let bestDist = Infinity;
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let r = r0 - ring; r <= r0 + ring; r++) {
      for (let c = c0 - ring; c <= c0 + ring; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== ring) continue;
        if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) continue;
        const i = nav.index[r * nav.cols + c];
        if (i < 0) continue;
        const n = nav.nodes[i];
        const dist = Math.hypot(n.x - pos[0], (n.y - pos[1]) * 2, n.z - pos[2]);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}
