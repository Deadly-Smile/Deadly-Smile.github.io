// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising pathfinding and the bot brain. Run with:
//   node src/Pages/games/FPS/engine/ai.test.js
import { findPath, smoothPath } from "./path.js";
import { buildNavGraph, nearestNode } from "./nav.js";
import {
  createBot, thinkBot, hear, notifyDamage, canSee, pickTarget, keysFor, yawTo, DIFFICULTY,
} from "./ai.js";
import { createPlayer, stepPlayer } from "./player.js";
import { stepWeapons } from "./weapons.js";
import { createHealth } from "./damage.js";
import { lineOfSight, bodyBox, overlapsAny } from "./geometry.js";
import { box, perimeter } from "../maps/build.js";
import { STEP } from "./loop.js";

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
const round = (v, d = 3) => +v.toFixed(d);
const seeded = (s = 42) => () => (s = (s * 16807) % 2147483647) / 2147483647;

// 30 × 30 room; a wall across the middle (x -15..9) with a gap at the east
// end, and a tall crate nobody can climb.
const room = {
  id: "room", size: [30, 30],
  boxes: [
    ...perimeter(30, 30, 3),
    box(-3, 0, 24, 0.6, 3),        // wall x -15..9, z ±0.3
    box(-8, 8, 1, 1, 3),           // tall crate
  ],
};
const nav = buildNavGraph(room);
const world = (actors) => ({ boxes: room.boxes, nav, actors });
const node = (x, z) => nearestNode(nav, [x, 0, z]);
const target = (x, z, team = "player") => Object.assign(createPlayer({ pos: [x, 0, z] }), { id: `t${x},${z}`, team, health: createHealth() });

// ─── Pathfinding ─────────────────────────────────────────────────────────────
{
  const path = findPath(nav, node(-5, -5), node(-5, 5));
  check("path found around the wall", !!path, true);
  check("it goes through the gap at the east end", path.some(i => nav.nodes[i].x > 9), true);
  check("every step is a nav link", path.every((k, i) => i === 0 || nav.neighbors[path[i - 1]].includes(k)), true);
  check("unreachable goal → null", findPath(nav, node(-5, -5), nearestNode(nav, [-8, 3, 8], 0)), null);
  // A goal right at the crate resolves to the floor beside it when the
  // search is limited to the walker's own component.
  const beside = nearestNode(nav, [-8, 0, 8], 4, nav.nodes[node(-5, -5)].component);
  check("goal at an unclimbable crate → floor next to it", [beside >= 0, nav.nodes[beside]?.y], [true, 0]);
  check("…which is reachable", !!findPath(nav, node(-5, -5), beside), true);

  const open = findPath(nav, node(-6, -10), node(4, -4)); // within the smoothing look-ahead
  const smooth = smoothPath(nav, open, room.boxes);
  check("open ground smooths to a straight line", smooth.length, 2);
  const around = smoothPath(nav, path, room.boxes);
  check("smoothing keeps the endpoints", [around[0], around.at(-1)], [path[0], path.at(-1)]);
  check("smoothing never cuts through the wall", around.every((k, i) => {
    if (i === 0) return true;
    const a = nav.nodes[around[i - 1]];
    const b = nav.nodes[k];
    return lineOfSight([a.x, 1, a.z], [b.x, 1, b.z], room.boxes);
  }), true);
}

// ─── Geometry helpers ────────────────────────────────────────────────────────
check("yaw toward -z is 0", round(yawTo([0, 0, 0], [0, 0, -5])), 0);
check("yaw toward -x is +90°", round(yawTo([0, 0, 0], [-5, 0, 0])), round(Math.PI / 2));
check("keys: straight ahead", keysFor(0, [0, -1]), { forward: true, back: false, left: false, right: false });
check("keys: to the right", keysFor(0, [1, 0]), { forward: false, back: false, left: false, right: true });
check("keys: diagonal back-left", keysFor(0, [-0.7, 0.7]), { forward: false, back: true, left: true, right: false });

// ─── Perception ──────────────────────────────────────────────────────────────
{
  // Facing +z (yaw π), toward the wall.
  const bot = createBot({ id: "b", team: "enemy", spawn: { pos: [5, 0, -10], yaw: Math.PI } });
  const opts = { range: 45 };
  check("sees a target ahead", canSee(bot, target(5, -4), room.boxes, opts), true);
  check("not behind its back", canSee(bot, target(5, -13), room.boxes, opts), false);
  check("…unless aware of all directions", canSee(bot, target(5, -13), room.boxes, { ...opts, anyDirection: true }), true);
  check("not through a wall", canSee(bot, target(5, 5), room.boxes, opts), false);
  check("not beyond its view range", canSee(bot, target(5, -4), room.boxes, { range: 4 }), false);

  const friend = target(5, -5, "enemy");
  const near = target(4, -6);
  const far = target(6, -2);
  check("ignores its own team, picks the nearest enemy", pickTarget(bot, [bot, friend, far, near], room.boxes, opts)?.id, near.id);
  near.health.dead = true;
  check("ignores the dead", pickTarget(bot, [bot, near, far], room.boxes, opts)?.id, far.id);
}

// ─── State machine ───────────────────────────────────────────────────────────
// Runs the brain (and the bot's body/gun) for `seconds`; returns how many
// ticks it pulled the trigger and every state it passed through.
function run(bot, actors, seconds, rand, onTick) {
  let fired = 0;
  const states = [bot.brain.state];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    const { move, weapon } = thinkBot(bot, world(actors), STEP, rand);
    stepPlayer(bot, move, STEP, room.boxes);
    const { events } = stepWeapons(bot.loadout, weapon, STEP, {}, rand);
    fired += events.filter(e => e.type === "shot").length;
    if (states.at(-1) !== bot.brain.state) states.push(bot.brain.state);
    onTick?.(bot);
  }
  return { fired, states };
}

{
  const rand = seeded();
  const bot = createBot({ id: "b", team: "enemy", spawn: { pos: [5, 0, -12], yaw: Math.PI }, difficulty: "normal" });
  const player = target(5, -3);
  let r = run(bot, [bot, player], STEP, rand);
  check("spots a visible enemy → attack", bot.brain.state, "attack");
  check("doesn't fire before its reaction time", r.fired, 0);
  r = run(bot, [bot, player], DIFFICULTY.normal.reaction * 0.7, rand);
  check("still holding fire inside the reaction time", r.fired, 0);
  r = run(bot, [bot, player], 2, rand);
  check("then fires", r.fired > 0, true);

  // The target ducks behind the wall: chase to where it was seen, then search.
  player.pos = [-10, 0, 8];
  r = run(bot, [bot, player], 0.6, rand);
  check("loses sight → chase", bot.brain.state, "chase");
  r = run(bot, [bot, player], 15, rand);
  check("chase ends in a search", r.states.includes("search"), true);
}
{
  const rand = seeded(7);
  const bot = createBot({ id: "b", team: "enemy", spawn: { pos: [-10, 0, -10], yaw: 0 } });
  bot.brain.state = "search";
  const r = run(bot, [bot], 6, rand);
  check("search gives up → patrol", r.states.includes("patrol"), true);
  const start = [...bot.pos];
  run(bot, [bot], 8, rand);
  check("patrol wanders off", Math.hypot(bot.pos[0] - start[0], bot.pos[2] - start[2]) > 3, true);
}
{
  const bot = createBot({ id: "b", team: "enemy", spawn: { pos: [-10, 0, -10], yaw: 0 } });
  hear(bot, [10, 0, -10]);
  check("hearing a shot → alert", bot.brain.state, "alert");
  const r = run(bot, [bot], 1, seeded(3));
  check("…and it heads toward the noise", bot.pos[0] > -10 && r.states[0] === "alert", true);

  const shot = createBot({ id: "s", team: "enemy", spawn: { pos: [-10, 0, -10], yaw: 0 } });
  notifyDamage(shot, [-10, 0, -2]);
  check("being shot from behind → chase toward the shooter", [shot.brain.state, shot.brain.lastSeen], ["chase", [-10, 0, -2]]);
}

// ─── A full hunt ─────────────────────────────────────────────────────────────
// Bot on one side of the wall, player on the other: it hears a shot, walks
// around through the gap, spots the player and opens fire — without ever
// clipping into the map.
{
  const rand = seeded(11);
  const bot = createBot({ id: "b", team: "enemy", spawn: { pos: [-8, 0, -8], yaw: 0 }, primary: "rifle" });
  const player = target(-10, 8);
  hear(bot, player.pos);
  let inside = 0;
  const r = run(bot, [bot, player], 20, rand, b => {
    if (overlapsAny(bodyBox(b.pos, { height: b.height }), room.boxes)) inside++;
  });
  check("hunt: alert → … → attack", r.states.includes("attack"), true);
  check("hunt: opens fire", r.fired > 0, true);
  check("hunt: never inside a wall", inside, 0);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll AI checks passed");
