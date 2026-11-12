// Symmetric arena: a raised centre platform reached by two flights of steps,
// pillars, chest-high walls, and a walled bunker in each corner.
import { box, perimeter, stairs, spawn, mirrorX, mirrorZ } from "./build.js";

const W = 48;
const D = 48;

// One corner bunker (north-west); mirrored into the other three.
const bunker = [
  box(-20.5, -17, 7, 0.6, 3),     // wall along x, door at the corner x=-17, z -19..-17
  box(-17, -21.5, 0.6, 5, 3),
];
const corner = [...bunker, ...mirrorX(bunker)];

export default {
  id: "arena",
  name: "Arena",
  desc: "Small and symmetric. Centre platform, pillars, corner bunkers.",
  size: [W, D],
  theme: {
    sky: 0x0b1220,
    floor: 0x2b3442,
    fog: [30, 90],
    mats: { wall: 0x52627a, concrete: 0x7b8798, pillar: 0x3b475a, low: 0x0e7490, accent: 0xe11d48 },
  },
  boxes: [
    ...perimeter(W, D, 4),

    // Centre platform, 2 m up, steps from north and south.
    box(0, 0, 8, 8, 2, { mat: "concrete" }),
    ...stairs(0, 9, "-z", 5),
    ...stairs(0, -9, "+z", 5),

    box(-10, -10, 2, 2, 4, { mat: "pillar" }),
    box(10, -10, 2, 2, 4, { mat: "pillar" }),
    box(-10, 10, 2, 2, 4, { mat: "pillar" }),
    box(10, 10, 2, 2, 4, { mat: "pillar" }),

    box(0, -14, 8, 0.6, 1.1, { mat: "low" }),
    box(0, 14, 8, 0.6, 1.1, { mat: "low" }),
    box(-14, 0, 0.6, 8, 1.1, { mat: "low" }),
    box(14, 0, 0.6, 8, 1.1, { mat: "low" }),

    box(-18, -6, 1.5, 1.5, 1.5, { mat: "accent" }),
    box(18, 6, 1.5, 1.5, 1.5, { mat: "accent" }),

    ...corner,
    ...mirrorZ(corner),
  ],
  playerSpawns: [spawn(0, 0, 20), spawn(-5, 0, 20), spawn(5, 0, 20)],
  enemySpawns: [
    spawn(-21, 0, -21),
    spawn(21, 0, -21),
    spawn(-21, 0, 21),
    spawn(21, 0, 21),
    spawn(0, 0, -20),
  ],
  teamSpawns: {
    a: [spawn(-6, 0, 21), spawn(-2, 0, 21), spawn(2, 0, 21), spawn(6, 0, 21)],
    b: [spawn(-6, 0, -21, Math.PI), spawn(-2, 0, -21, Math.PI), spawn(2, 0, -21, Math.PI), spawn(6, 0, -21, Math.PI)],
  },
};
