// Warehouse: an original industrial map. A roofed hall with three aisles of
// tall shelving and a cross aisle, an office block with rooms and doorways
// in the north-east, and three loading doors out to a truck yard with a
// raised loading dock. Drawn as an ASCII grid (ascii.js), 2 m per cell,
// north at the top:
//   # outer wall   W office wall   S shelving   = barrier   c crate
//   C crate stack   m truck/container   R dock with steps 1-2-3
//   P player   E hidden enemy   a / b teams
import { fromAscii } from "./ascii.js";

const ROWS = [
  "########################################",
  "#.E......................W....W......E.#",
  "#.b.....b.......b.....b..W.c..W...c....#",
  "#.....S...S...S..........W.............#",
  "#.....S...S...S....cc.........W........#",
  "#.....S...S...S...............W........#",
  "#.....S...S...S..........WWWWWW..WWWWWW#",
  "#.....S...S...S..........W.............#",
  "#..................CC....W..C.......c..#",
  "#.......E..........CC....W.E...........#",
  "#.....S...S...S...........WWWWWWWWW..WW#",
  "#.....S...S...S........................#",
  "#.==..S...S...S......c.................#",
  "#.....S...S...S..............====......#",
  "#.....S...S...S..c.....................#",
  "#.....S...S...S...1111..............C..#",
  "#...........E.....2222...............E.#",
  "#.................3333.................#",
  "####....##########RRRR##########....####",
  "####....##########RRRR##########....####",
  "#........123RRRRRRRRRRRRRRRR321........#",
  "#.C......123RRRRRRRRRRRRRRRR321........#",
  "#......................................#",
  "#...mmm..........................mmm...#",
  "#...mmm..........mmmmmm..........mmm...#",
  "#...mmm..........mmmmmm..........mmm...#",
  "#..........c................C..........#",
  "#............P.....P......P............#",
  "#........a.....a........a.....a........#",
  "########################################",
];

const LEGEND = {
  "#": { h: 7, mat: "cladding" },
  W: { h: 3.2, mat: "drywall" },
  S: { h: 3.6, mat: "rack" },
  "=": { h: 1.1, mat: "concrete" },
  c: { h: 1.2, mat: "crate" },
  C: { h: 2.4, mat: "crate" },
  m: { h: 2.8, mat: "container" },
  R: { h: 1.2, mat: "concrete" },
  1: { h: 0.4, mat: "concrete" },
  2: { h: 0.8, mat: "concrete" },
  3: { h: 1.2, mat: "concrete" },
};

const { size, boxes, spawns } = fromAscii(ROWS, LEGEND);

// The hall's roof (rows 1-17): visual only — not collidable, so it doesn't
// affect movement, bots or bullets. Strips with skylight gaps between them.
const [W, D] = size;
const roof = [];
for (let x = -W / 2 + 2; x < W / 2 - 2; x += 8) {
  roof.push({ min: [x, 7, -D / 2 + 2], max: [x + 6, 7.4, -D / 2 + 36], mat: "roof" });
}

export default {
  id: "warehouse",
  name: "Warehouse",
  desc: "Shelf aisles, offices, a loading dock and yard.",
  size,
  theme: {
    sky: 0xaab4bf,
    floor: 0x8d8c88,
    floorTex: "concrete",
    fog: [40, 120],
    mats: { cladding: 0x7f8a94, drywall: 0xd6d2c8, rack: 0xc7863a, concrete: 0xa3a19b, crate: 0xa77b47, container: 0x3d6b8f, roof: 0x5c646c },
    tex: { cladding: "corrugated", drywall: "plaster", rack: "rack", concrete: "concrete", crate: "wood", container: "corrugated", roof: "corrugated" },
  },
  boxes,
  decor: roof,
  playerSpawns: spawns.player,
  enemySpawns: spawns.enemy,
  teamSpawns: { a: spawns.a, b: spawns.b },
};
