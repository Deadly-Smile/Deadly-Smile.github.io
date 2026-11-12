// Old Quarter: an original three-lane town map in the style of tactical
// shooters. Two walled courtyards (north-west and north-east) are reached by
// a long western lane, a middle street with a choke doorway and side
// connectors, and a tight eastern alley; buildings fill everything else, so
// sightlines stay short. Drawn as an ASCII grid (ascii.js), 2 m per cell,
// north at the top:
//   # building   = low wall   c crate   C crate stack   m container
//   R raised terrace with steps 1-2-3   P player   E hidden enemy   a / b teams
import { fromAscii } from "./ascii.js";

const ROWS = [
  "########################################",
  "#E........RRR##bb......bb##...........E#",
  "#.........RRR....C.....................#",
  "#.........333.........C............cc..#",
  "#....cc...222##E........E##....mm......#",
  "#....c....111#####....#####....mm......#",
  "#............#####....#####....mm......#",
  "#.......C....#####....#####............#",
  "#.===...C....#####....#####.cC....====.#",
  "#...........E#####c...#####E...........#",
  "#............#####....#####............#",
  "#....###..########...c#############....#",
  "#....###..............#############....#",
  "#....###..............#############....#",
  "#....#############....#############....#",
  "#....##############..##############.c..#",
  "#....#############....#############....#",
  "#....#############....#############....#",
  "#.C..#############....#############....#",
  "#....#############..........c..........#",
  "#....#############.....................#",
  "#....#############....#############....#",
  "#..c.#############.C..#############....#",
  "#....#############....#############..C.#",
  "#....#############==..#############....#",
  "#....#############....#############....#",
  "#....#############....#############....#",
  "#....#####....................#####....#",
  "#....#####.....==.............#####....#",
  "#.................P..P.==..............#",
  "#####.........a.a..P...a.a.........#####",
  "########################################",
];

const LEGEND = {
  "#": { h: 6, mat: "plaster" },
  "=": { h: 1.1, mat: "stone" },
  c: { h: 1.2, mat: "crate" },
  C: { h: 2.4, mat: "crate" },
  m: { h: 2.6, mat: "container" },
  R: { h: 1.2, mat: "stone" },
  1: { h: 0.4, mat: "stone" },
  2: { h: 0.8, mat: "stone" },
  3: { h: 1.2, mat: "stone" },
};

const { size, boxes, spawns } = fromAscii(ROWS, LEGEND);

export default {
  id: "quarter",
  name: "Old Quarter",
  desc: "Tight streets, two courtyards, three lanes.",
  size,
  theme: {
    sky: 0x9fc3e0,
    floor: 0xb9a888,
    floorTex: "paving",
    fog: [40, 130],
    mats: { plaster: 0xd8c4a0, stone: 0xa9a092, crate: 0xa77b47, container: 0x4f7a64 },
    tex: { plaster: "plaster", stone: "stone", crate: "wood", container: "corrugated" },
  },
  boxes,
  playerSpawns: spawns.player,
  enemySpawns: spawns.enemy,
  teamSpawns: { a: spawns.a, b: spawns.b },
};
