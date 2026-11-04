// Freight yard at dusk: an open-roofed warehouse in the north, a loading dock
// in the middle, shipping containers and crate stacks for cover.
import { box, perimeter, stairs, spawn } from "./build.js";

const W = 64;
const D = 64;

export default {
  id: "yard",
  name: "Freight Yard",
  desc: "Warehouse, containers and a loading dock. Medium size.",
  size: [W, D],
  theme: {
    sky: 0x2a1f3d,
    floor: 0x4a4038,
    fog: [35, 110],
    mats: { wall: 0x6b5b4e, concrete: 0x8a8580, metal: 0x3f6f8f, metal2: 0x9a4a32, crate: 0xa0712f, accent: 0xd9a441 },
  },
  boxes: [
    ...perimeter(W, D, 4),

    // Warehouse x[-10,10] z[-20,-6]: doors in the south (x -2..2) and west (z -15..-11) walls.
    box(0, -19.7, 20, 0.6, 5),
    box(-6, -6.3, 8, 0.6, 5),
    box(6, -6.3, 8, 0.6, 5),
    box(-9.7, -17.5, 0.6, 5, 5),
    box(-9.7, -8.5, 0.6, 5, 5),
    box(9.7, -13, 0.6, 14, 5),
    box(-5, -16, 2, 2, 2, { mat: "crate" }),
    box(4, -11, 3, 1.5, 1.2, { mat: "crate" }),
    box(2, -17.6, 8, 1, 3, { mat: "metal" }),

    // Loading dock with steps on both ends.
    box(0, 14, 10, 4, 1.2, { mat: "concrete" }),
    ...stairs(-8, 14, "+x", 3),
    ...stairs(8, 14, "-x", 3),

    // Containers (one stacked pair).
    box(-20, 10, 2.4, 6, 2.6, { mat: "metal" }),
    box(-20, 10, 2.4, 6, 2.6, { y: 2.6, mat: "metal2" }),
    box(-16, 10, 2.4, 6, 2.6, { mat: "metal2" }),
    box(18, 14, 6, 2.4, 2.6, { mat: "metal" }),
    box(18, 20, 6, 2.4, 2.6, { mat: "metal2" }),
    box(20, -14, 2.4, 6, 2.6, { mat: "metal" }),

    // Sheds in the far corners.
    box(-24, -24, 6, 4, 3),
    box(24, -24, 6, 4, 3),

    // Loose crates.
    box(-8, 0, 1.5, 1.5, 1.5, { mat: "crate" }),
    box(10, 2, 2, 2, 2, { mat: "crate" }),
    box(-24, -6, 2, 2, 1, { mat: "crate" }),
    box(24, 0, 1.2, 4, 1.2, { mat: "crate" }),
    box(-14, -26, 3, 1, 1.2, { mat: "crate" }),
    box(14, 26, 2, 2, 2, { mat: "crate" }),
    box(-12, 22, 4, 1, 1.1, { mat: "accent" }),
  ],
  playerSpawns: [spawn(0, 0, 26), spawn(-6, 0, 27), spawn(6, 0, 27)],
  enemySpawns: [
    spawn(6, 0, -16),
    spawn(-6, 0, -12),
    spawn(-24, 0, 4),
    spawn(-24, 0, -28),
    spawn(24, 0, -28),
    spawn(22.5, 0, -17),
  ],
  teamSpawns: {
    a: [spawn(-4, 0, 28), spawn(0, 0, 28), spawn(4, 0, 28), spawn(8, 0, 28)],
    b: [spawn(-4, 0, -28, Math.PI), spawn(0, 0, -28, Math.PI), spawn(4, 0, -28, Math.PI), spawn(8, 0, -28, Math.PI)],
  },
};
