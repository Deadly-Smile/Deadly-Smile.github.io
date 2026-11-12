// ─── Map authoring helpers ──────────────────────────────────────────────────
// A map is plain data:
//   {
//     id, name, desc,
//     size: [w, d],              playable floor, centred on the origin (x, z)
//     theme: { sky, floor, fog: [near, far], mats: { <mat>: color } },
//     boxes: [{ min: [x,y,z], max: [x,y,z], mat }],
//     playerSpawns: [{ pos: [x,y,z], yaw }],   single-player starts
//     enemySpawns:  [{ pos }],                 hidden from every player spawn
//     teamSpawns:   { a: [{ pos, yaw }], b: [...] }   Team Deathmatch
//   }
// Positions are feet positions; y is the surface height there (0 = floor).
// yaw is radians around +y, 0 facing -z (three.js camera default).
// Everything is axis-aligned boxes: walls, crates, stairs (stacked steps).

// Box by centre (x, z), size (w along x, d along z, h tall), resting on y.
export function box(x, z, w, d, h, { y = 0, mat = "wall" } = {}) {
  return { min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + h, z + d / 2], mat };
}

// Four walls just inside the edge of a w × d floor.
export function perimeter(w, d, h, { t = 1, mat = "wall" } = {}) {
  return [
    box(0, -d / 2 + t / 2, w, t, h, { mat }),
    box(0, d / 2 - t / 2, w, t, h, { mat }),
    box(-w / 2 + t / 2, 0, t, d - 2 * t, h, { mat }),
    box(w / 2 - t / 2, 0, t, d - 2 * t, h, { mat }),
  ];
}

// A flight of solid steps. (x, z) is the centre of the low end's outer edge;
// the flight climbs toward `dir` ("+x" | "-x" | "+z" | "-z"), `steps` steps of
// `rise` up and `run` along. Rise must stay under STEP_HEIGHT to be walkable.
export function stairs(x, z, dir, steps, { width = 2, rise = 0.4, run = 1, mat = "concrete" } = {}) {
  const sign = dir[0] === "-" ? -1 : 1;
  const alongX = dir[1] === "x";
  const out = [];
  for (let i = 0; i < steps; i++) {
    const offset = sign * (i + 0.5) * run;
    const h = rise * (i + 1);
    out.push(alongX
      ? box(x + offset, z, run, width, h, { mat })
      : box(x, z + offset, width, run, h, { mat }));
  }
  return out;
}

export const spawn = (x, y, z, yaw = 0) => ({ pos: [x, y, z], yaw });

// Mirror helpers for symmetric layouts.
export const mirrorX = (boxes) => boxes.map(b => ({ ...b, min: [-b.max[0], b.min[1], b.min[2]], max: [-b.min[0], b.max[1], b.max[2]] }));
export const mirrorZ = (boxes) => boxes.map(b => ({ ...b, min: [b.min[0], b.min[1], -b.max[2]], max: [b.max[0], b.max[1], -b.min[2]] }));
