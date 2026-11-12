// ─── Maps drawn as ASCII grids ──────────────────────────────────────────────
// Tight, detailed layouts (streets, corridors, rooms) are far easier to
// design as a picture than as box coordinates. Each character is one
// `cell`-metre square, seen from above with row 0 at the north (-z) edge:
//
//   solid cells  any character in `legend` → a box of that height/material
//                (e.g. "#" building, "=" low wall, "c" crate, "1".."3" steps)
//   spawns       P player start, E hidden enemy spawn, a / b team spawns
//                (on the floor at the cell's centre)
//   anything else is open floor
//
// Neighbouring cells of the same character are merged into as few boxes as
// possible (greedy rectangles), so a long wall is one box, not twenty.
// Pure; produces the usual map shape (see build.js) minus theme/name.

const SPAWN = { P: "player", E: "enemy", a: "a", b: "b" };
// Which way spawns face: the player and team A look north (-z), enemies and
// team B south.
const FACING = { player: 0, a: 0, enemy: Math.PI, b: Math.PI };

// legend: { char: { h, mat, y = 0 } }
export function fromAscii(rows, legend, cell = 2) {
  const H = rows.length;
  const W = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== W) throw new Error(`ascii map: row ${i} is ${r.length} wide, expected ${W}`);
  });
  const size = [W * cell, H * cell];
  const cx = (c) => -size[0] / 2 + (c + 0.5) * cell;
  const cz = (r) => -size[1] / 2 + (r + 0.5) * cell;

  const boxes = [];
  const taken = rows.map(r => Array(r.length).fill(false));
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = rows[r][c];
      const def = legend[ch];
      if (!def || taken[r][c]) continue;
      // Widest run to the right, then as many rows down as fit that run.
      let w = 1;
      while (c + w < W && rows[r][c + w] === ch && !taken[r][c + w]) w++;
      let h = 1;
      const rowFits = (rr) => {
        for (let k = c; k < c + w; k++) if (rows[rr][k] !== ch || taken[rr][k]) return false;
        return true;
      };
      while (r + h < H && rowFits(r + h)) h++;
      for (let rr = r; rr < r + h; rr++) for (let k = c; k < c + w; k++) taken[rr][k] = true;
      const y = def.y ?? 0;
      boxes.push({
        min: [-size[0] / 2 + c * cell, y, -size[1] / 2 + r * cell],
        max: [-size[0] / 2 + (c + w) * cell, y + def.h, -size[1] / 2 + (r + h) * cell],
        mat: def.mat,
      });
    }
  }

  const spawns = { player: [], enemy: [], a: [], b: [] };
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const kind = SPAWN[rows[r][c]];
      if (kind) spawns[kind].push({ pos: [cx(c), 0, cz(r)], yaw: FACING[kind] });
    }
  }
  return { size, boxes, spawns };
}
