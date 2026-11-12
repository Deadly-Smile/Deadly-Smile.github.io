// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the map geometry, nav grid and validator. Run with:
//   node src/Pages/games/FPS/maps/maps.test.js
import { MAPS, getMap } from "./index.js";
import { fromAscii } from "./ascii.js";
import { box, stairs, perimeter, spawn, mirrorX } from "./build.js";
import { validateMap } from "./validate.js";
import { buildNavGraph, nearestNode } from "../engine/nav.js";
import { boxesOverlap, segmentHitsBox, raycastBoxes, groundHeightAt, lineOfSight } from "../engine/geometry.js";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`✗ ${name}`);
    console.error("  expected:", JSON.stringify(expected));
    console.error("  actual:  ", JSON.stringify(actual));
  } else {
    console.log(`✓ ${name}`);
  }
}

// ─── Geometry ────────────────────────────────────────────────────────────────
{
  const a = box(0, 0, 2, 2, 2);
  check("box from centre/size", [a.min, a.max], [[-1, 0, -1], [1, 2, 1]]);
  check("overlapping boxes", boxesOverlap(a, box(1.5, 0, 2, 2, 2)), true);
  check("touching boxes don't overlap", boxesOverlap(a, box(2, 0, 2, 2, 2)), false);

  check("segment through a box", segmentHitsBox([-5, 1, 0], [5, 1, 0], a), 0.4);
  check("segment over a box", segmentHitsBox([-5, 3, 0], [5, 3, 0], a), null);
  check("segment stopping short", segmentHitsBox([-5, 1, 0], [-2, 1, 0], a), null);
  check("segment starting inside", segmentHitsBox([0, 1, 0], [5, 1, 0], a), 0);
  check("nearest of several hits", raycastBoxes([-10, 1, 0], [10, 1, 0], [box(5, 0, 1, 1, 2), a]).index, 1);
  check("no line of sight through a wall", lineOfSight([-5, 1, 0], [5, 1, 0], [a]), false);

  check("floor height off boxes", groundHeightAt(5, 5, [a]), 0);
  check("ground height on a box", groundHeightAt(0.5, 0.5, [a, box(0, 0, 1, 1, 3, { y: 0 })]), 3);
}

// ─── Builders ────────────────────────────────────────────────────────────────
{
  const s = stairs(0, 0, "+x", 3);
  check("stairs climb toward +x", s.map(b => [b.min[0], b.max[0], +b.max[1].toFixed(2)]), [[0, 1, 0.4], [1, 2, 0.8], [2, 3, 1.2]]);
  const n = stairs(0, 0, "-z", 2);
  check("stairs climb toward -z", n.map(b => [b.min[2], b.max[2]]), [[-1, 0], [-2, -1]]);
  check("perimeter has 4 walls inside the bounds", perimeter(10, 10, 3).every(b => b.min[0] >= -5 && b.max[0] <= 5 && b.min[2] >= -5 && b.max[2] <= 5), true);
  const m = mirrorX([box(3, 0, 2, 2, 1)])[0];
  check("mirrorX", [m.min[0], m.max[0]], [-4, -2]);
}

// ─── Nav grid ────────────────────────────────────────────────────────────────
{
  // 10 × 10 room (nodes at half-metres) split by a wall with a doorway at the
  // north end, plus a 1.2 m platform reached by two steps.
  const room = {
    id: "room", size: [10, 10],
    boxes: [
      box(0, -2, 0.6, 6, 3),                 // wall x -0.3..0.3, z -5..1
      box(3, 3, 4, 2, 1.2),                  // platform x 1..5, z 2..4
      ...stairs(-1, 3, "+x", 2),             // steps x -1..1 (0.4, 0.8)
      box(-3.5, -3.5, 1, 1, 3),              // a tall crate nobody can climb
    ],
  };
  const nav = buildNavGraph(room);
  const at = (x, y, z) => nav.nodes[nearestNode(nav, [x, y, z], 0)];
  check("no node inside the wall", nearestNode(nav, [0.5, 0, -2.5], 0), -1);
  check("both sides of the wall are connected via the doorway", at(-2.5, 0, -2.5).component === at(2.5, 0, -2.5).component, true);
  check("platform reached by the steps", at(3.5, 1.2, 3.5).component === at(-2.5, 0, -2.5).component, true);
  check("platform height", at(3.5, 1.2, 3.5).y, 1.2);
  check("top of the tall crate isn't reachable", at(-3.5, 3, -3.5).component === nav.mainComponent, false);
  check("node beside the wall is cover", at(-1.5, 0, -2.5).cover, true);
  check("node in the open isn't cover", at(-2.5, 0, 3.5).cover, false);

  // A diagonal step that would clip a box's corner is refused.
  const corner = buildNavGraph({ id: "c", size: [4, 4], boxes: [box(0.5, 0.5, 1, 1, 3)] });
  const ci = (x, z) => nearestNode(corner, [x, 0, z], 0);
  check("no diagonal past a corner", corner.neighbors[ci(-0.5, 0.5)].includes(ci(0.5, 1.5)), false);
  check("open diagonal is linked", corner.neighbors[ci(-1.5, -1.5)].includes(ci(-0.5, -0.5)), true);
}

// ─── Validator catches bad maps ──────────────────────────────────────────────
{
  const good = getMap("arena");
  check("arena is valid", validateMap(good), []);
  const inCrate = { ...good, playerSpawns: [spawn(0, 0, 0)] };
  const errs = validateMap(inCrate);
  check("spawn on the platform at y=0 is flagged", errs.some(e => /surface there is y=2/.test(e)), true);
  const visible = { ...good, enemySpawns: [...good.enemySpawns.slice(0, 4), spawn(0, 0, 18)] };
  check("visible enemy spawn is flagged", validateMap(visible).some(e => /enemy spawn 4 is visible/.test(e)), true);
  const unknownMat = { ...good, boxes: [...good.boxes, box(0, 18, 1, 1, 1, { mat: "nope" })] };
  check("unknown material is flagged", validateMap(unknownMat).some(e => /unknown material/.test(e)), true);
}

// ─── ASCII maps ──────────────────────────────────────────────────────────────
{
  const legend = { "#": { h: 3, mat: "wall" }, c: { h: 1, mat: "crate" } };
  const m = fromAscii([
    "#####",
    "#.P.#",
    "#cc.#",
    "#cc.#",
    "#E.a#",
  ], legend, 2);
  check("size from the grid and cell size", m.size, [10, 10]);
  check("same-character cells merge into one box", m.boxes.filter(b => b.mat === "crate").length, 1);
  const crate = m.boxes.find(b => b.mat === "crate");
  check("the merged crate covers its 2×2 cells", [crate.min, crate.max], [[-3, 0, -1], [1, 1, 3]]);
  check("row 0 is the north (-z) edge", m.boxes.some(b => b.mat === "wall" && b.min[2] === -5 && b.max[0] - b.min[0] === 10), true);
  check("spawns land on cell centres, on the floor", m.spawns.player[0].pos, [0, 0, -2]);
  check("enemies face south, the player north", [m.spawns.enemy[0].yaw, m.spawns.player[0].yaw], [Math.PI, 0]);
  check("team spawns are read too", m.spawns.a.length, 1);
  let threw = false;
  try { fromAscii(["##", "#"], legend); } catch { threw = true; }
  check("ragged rows are rejected", threw, true);
}
{
  // The tactical maps are mostly buildings: under half the area is open floor.
  const open = (id) => {
    const map = getMap(id);
    return buildNavGraph(map).nodes.filter(n => n.y === 0).length / (map.size[0] * map.size[1]);
  };
  check("Old Quarter is tight", open("quarter") < 0.5, true);
  check("…tighter than the open Freight Yard", open("quarter") < open("yard"), true);
}

// ─── Every shipped map ───────────────────────────────────────────────────────
check("map ids are unique", new Set(MAPS.map(m => m.id)).size, MAPS.length);
check("at least two maps", MAPS.length >= 2, true);
for (const map of MAPS) {
  const nav = buildNavGraph(map);
  check(`${map.id}: valid`, validateMap(map, nav), []);
}
{
  const reachable = (id, pos) => {
    const nav = buildNavGraph(getMap(id));
    const i = nearestNode(nav, pos, 0);
    return i >= 0 && nav.nodes[i].component === nav.mainComponent && nav.nodes[i].y === pos[1];
  };
  check("yard: loading dock is walkable", reachable("yard", [0, 1.2, 14]), true);
  check("arena: centre platform is walkable", reachable("arena", [0, 2, 0]), true);
  check("blocks: low rooftop is walkable", reachable("blocks", [20, 2.4, -20]), true);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll map checks passed");
