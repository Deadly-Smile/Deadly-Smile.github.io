// Town blocks: eight solid buildings around a central plaza, streets with
// parked cars and barriers, one low building with a climbable roof.
import { box, perimeter, stairs, spawn } from "./build.js";

const W = 72;
const D = 72;

// Buildings sit on a 3 × 3 grid (centres ±20, 12 × 12 footprints, 8 m
// streets between them); the middle cell is the plaza.
const building = (x, z, h, mat = "wall") => box(x, z, 12, 12, h, { mat });

export default {
  id: "blocks",
  name: "Town Blocks",
  desc: "Large. Streets, a plaza and one rooftop to fight over.",
  size: [W, D],
  theme: {
    sky: 0x87a8c9,
    floor: 0x5b5f63,
    fog: [45, 140],
    mats: { wall: 0xb8a48c, wall2: 0x8f9eaa, wall3: 0xa5765d, roof: 0x6f7c5a, car: 0x2563eb, car2: 0xb91c1c, barrier: 0xd4d4d4, concrete: 0x8a8a85 },
  },
  boxes: [
    ...perimeter(W, D, 5),

    building(-20, -20, 8),
    building(0, -20, 10, "wall2"),
    building(20, -20, 2.4, "roof"),   // low, climbable from the west
    building(-20, 0, 7, "wall3"),
    building(20, 0, 9),
    building(-20, 20, 10, "wall2"),
    building(0, 20, 6, "wall3"),
    building(20, 20, 8),
    ...stairs(8, -20, "+x", 6),

    // Plaza fountain and benches.
    box(0, 0, 4, 4, 0.8, { mat: "concrete" }),
    box(-4, -4, 2, 0.6, 0.5, { mat: "concrete" }),
    box(4, 4, 2, 0.6, 0.5, { mat: "concrete" }),

    // Parked cars.
    box(10, -8, 2, 4.5, 1.5, { mat: "car" }),
    box(-10, 16, 2, 4.5, 1.5, { mat: "car2" }),
    box(18, 10, 4.5, 2, 1.5, { mat: "car2" }),
    box(-22, -10, 4.5, 2, 1.5, { mat: "car" }),
    box(30, 22, 2, 4.5, 1.5, { mat: "car" }),

    // Road barriers.
    box(30, 0, 0.6, 6, 1.1, { mat: "barrier" }),
    box(-30, 8, 0.6, 6, 1.1, { mat: "barrier" }),
    box(0, 30, 6, 0.6, 1.1, { mat: "barrier" }),
    box(-8, -30, 6, 0.6, 1.1, { mat: "barrier" }),
  ],
  playerSpawns: [spawn(0, 0, -4), spawn(4, 0, 0), spawn(-4, 0, 0), spawn(0, 0, 4, Math.PI)],
  enemySpawns: [
    spawn(31, 0, 31),
    spawn(-31, 0, 31),
    spawn(31, 0, -31),
    spawn(-31, 0, -31),
    spawn(0, 0, 31),
    spawn(0, 0, -31),
  ],
  teamSpawns: {
    a: [spawn(-31, 0, -6, -Math.PI / 2), spawn(-31, 0, -2, -Math.PI / 2), spawn(-31, 0, 2, -Math.PI / 2), spawn(-31, 0, 6, -Math.PI / 2)],
    b: [spawn(31, 0, -6, Math.PI / 2), spawn(31, 0, -2, Math.PI / 2), spawn(31, 0, 2, Math.PI / 2), spawn(31, 0, 6, Math.PI / 2)],
  },
};
