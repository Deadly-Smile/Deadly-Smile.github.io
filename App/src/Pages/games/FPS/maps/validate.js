// ─── Map validator ──────────────────────────────────────────────────────────
// Catches authoring mistakes that would otherwise only show up in play: a
// spawn inside a crate or floating in the air, a spawn bots can't walk to, an
// "hidden" enemy spawn the player can see from the start. Run by
// maps.test.js for every map. Pure.
import { bodyBox, groundHeightAt, overlapsAny, lineOfSight, EYE_HEIGHT } from "../engine/geometry.js";
import { buildNavGraph, nearestNode } from "../engine/nav.js";

const MIN_ENEMY_SPAWNS = 4;
const MIN_TEAM_SPAWNS = 4;
const CHEST = 1.0;

// Returns a list of problems (empty = valid). `nav` may be passed in to avoid
// rebuilding it.
export function validateMap(map, nav = buildNavGraph(map)) {
  const errors = [];
  const err = (msg) => errors.push(`${map.id}: ${msg}`);
  const [w, d] = map.size;

  if (!map.id || !map.name) err("missing id/name");
  if (!map.boxes?.length) err("no boxes");
  map.boxes.forEach((b, i) => {
    if (!(b.min[0] < b.max[0] && b.min[1] < b.max[1] && b.min[2] < b.max[2])) err(`box ${i} has min >= max`);
    if (b.min[1] < 0) err(`box ${i} goes below the floor`);
    if (b.min[0] < -w / 2 - 1e-6 || b.max[0] > w / 2 + 1e-6 || b.min[2] < -d / 2 - 1e-6 || b.max[2] > d / 2 + 1e-6) {
      err(`box ${i} is outside the map bounds`);
    }
    if (!map.theme?.mats?.[b.mat]) err(`box ${i} uses unknown material "${b.mat}"`);
  });

  const checkSpawn = (label, s) => {
    const [x, y, z] = s.pos;
    if (Math.abs(x) > w / 2 || Math.abs(z) > d / 2) return err(`${label} is outside the map`);
    const ground = groundHeightAt(x, z, map.boxes);
    if (Math.abs(ground - y) > 0.01) err(`${label} is at y=${y} but the surface there is y=${ground}`);
    if (overlapsAny(bodyBox([x, ground, z], { lift: 0.01 }), map.boxes)) err(`${label} is inside a box`);
    const n = nearestNode(nav, s.pos, 1);
    if (n < 0) err(`${label} has no nav node nearby`);
    else if (nav.nodes[n].component !== nav.mainComponent) err(`${label} can't be walked to from the rest of the map`);
  };

  if (!map.playerSpawns?.length) err("no player spawns");
  if ((map.enemySpawns?.length ?? 0) < MIN_ENEMY_SPAWNS) err(`needs at least ${MIN_ENEMY_SPAWNS} enemy spawns`);
  for (const team of ["a", "b"]) {
    if ((map.teamSpawns?.[team]?.length ?? 0) < MIN_TEAM_SPAWNS) err(`team ${team} needs at least ${MIN_TEAM_SPAWNS} spawns`);
  }

  map.playerSpawns?.forEach((s, i) => checkSpawn(`player spawn ${i}`, s));
  map.enemySpawns?.forEach((s, i) => checkSpawn(`enemy spawn ${i}`, s));
  for (const team of ["a", "b"]) map.teamSpawns?.[team]?.forEach((s, i) => checkSpawn(`team ${team} spawn ${i}`, s));

  // An enemy must never be visible the moment it spawns — neither its head
  // nor its chest from any player start.
  map.playerSpawns?.forEach((p, i) => {
    const eye = [p.pos[0], p.pos[1] + EYE_HEIGHT, p.pos[2]];
    map.enemySpawns?.forEach((e, j) => {
      for (const h of [CHEST, EYE_HEIGHT]) {
        if (lineOfSight(eye, [e.pos[0], e.pos[1] + h, e.pos[2]], map.boxes)) {
          err(`enemy spawn ${j} is visible from player spawn ${i}`);
          break;
        }
      }
    });
  });

  return errors;
}
