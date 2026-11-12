// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising player movement and collision. Run with:
//   node src/Pages/games/FPS/engine/player.test.js
import {
  createPlayer, stepPlayer, wishDir, look,
  WALK_SPEED, SPRINT_SPEED, CROUCH_SPEED, ADS_SPEED, CROUCH_HEIGHT, MAX_PITCH,
} from "./player.js";
import { BODY_HEIGHT, bodyBox, overlapsAny } from "./geometry.js";
import { MAPS } from "../maps/index.js";
import { box, stairs } from "../maps/build.js";
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

const NONE = { forward: false, back: false, left: false, right: false, jump: false, sprint: false, crouch: false };
const keys = (k) => ({ ...NONE, ...k });

// Runs `seconds` of ticks; `onTick(p)` sees the player after each one.
function run(p, input, seconds, boxes = [], onTick) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    stepPlayer(p, input, STEP, boxes);
    onTick?.(p);
  }
  return p;
}
const at = (x, y, z, yaw = 0) => createPlayer({ pos: [x, y, z], yaw });
const hSpeed = (p) => Math.hypot(p.vel[0], p.vel[2]);

// ─── Direction & look ────────────────────────────────────────────────────────
check("yaw 0 forward is -z", wishDir(keys({ forward: true }), 0).map(v => round(v)), [0, -1]);
check("yaw 0 right is +x", wishDir(keys({ right: true }), 0).map(v => round(v)), [1, 0]);
check("yaw 90° forward is -x", wishDir(keys({ forward: true }), Math.PI / 2).map(v => round(v)), [-1, 0]);
check("opposing keys cancel", wishDir(keys({ forward: true, back: true }), 0), [0, 0]);
check("diagonal is unit length", round(Math.hypot(...wishDir(keys({ forward: true, left: true }), 0))), 1);
{
  const p = at(0, 0, 0);
  look(p, 0, -10);
  check("pitch is clamped", p.pitch, MAX_PITCH);
}

// ─── Speeds ──────────────────────────────────────────────────────────────────
check("walk speed", round(hSpeed(run(at(0, 0, 0), keys({ forward: true }), 1))), WALK_SPEED);
check("diagonal isn't faster", round(hSpeed(run(at(0, 0, 0), keys({ forward: true, right: true }), 1))), WALK_SPEED);
check("sprint speed", round(hSpeed(run(at(0, 0, 0), keys({ forward: true, sprint: true }), 1))), SPRINT_SPEED);
check("no sprinting backwards", round(hSpeed(run(at(0, 0, 0), keys({ back: true, sprint: true }), 1))), WALK_SPEED);
check("aiming slows and blocks sprint", round(hSpeed(run(at(0, 0, 0), keys({ forward: true, sprint: true, ads: true }), 1))), ADS_SPEED);
check("crouch speed", round(hSpeed(run(at(0, 0, 0), keys({ forward: true, crouch: true }), 1))), CROUCH_SPEED);
{
  const p = run(at(0, 0, 0), keys({ forward: true }), 1);
  run(p, NONE, 0.5);
  check("stops when keys are released", round(hSpeed(p)), 0);
}

// ─── Walls ───────────────────────────────────────────────────────────────────
const wall = box(0, -3, 20, 1, 3); // z -3.5..-2.5
{
  const p = run(at(0, 0, 0), keys({ forward: true }), 2, [wall]);
  check("stops flush against a wall", round(p.pos[2]), -2.1);
}
{
  const p = run(at(0, 0, 0, Math.PI / 4), keys({ forward: true }), 2, [wall]);
  check("slides along a wall (z stopped)", round(p.pos[2]), -2.1);
  check("slides along a wall (x keeps going)", p.pos[0] < -4, true);
}
{
  // Sprinting at a thin wall for a long time never ends up on the other side.
  const thin = box(0, -3, 20, 0.6, 3);
  const p = run(at(0, 0, 0), keys({ forward: true, sprint: true }), 5, [thin]);
  check("no tunnelling through a thin wall", p.pos[2] > -2.7, true);
}

// ─── Steps, ledges, jumping ──────────────────────────────────────────────────
{
  const p = run(at(0, 0, 0), keys({ forward: true }), 2, [box(0, -6, 4, 8, 0.4)]);
  check("walks up a 0.4 m step", round(p.pos[1]), 0.4);
}
{
  const p = run(at(0, 0, 0), keys({ forward: true }), 2, [box(0, -3, 4, 2, 0.6)]);
  check("a 0.6 m ledge blocks walking", [round(p.pos[1]), round(p.pos[2])], [0, -1.6]);
}
{
  // Jump is one tick of input (the input layer turns a key press into one).
  const cover = box(0, -5, 4, 6, 1.1); // z -8..-2
  const p = run(at(0, 0, 1), keys({ forward: true }), 0.3, [cover]);
  run(p, keys({ forward: true, jump: true }), STEP, [cover]);
  run(p, keys({ forward: true }), 0.7, [cover]);
  check("jumps onto 1.1 m cover", round(p.pos[1]), 1.1);
}
{
  const crate = box(0, -2, 4, 1, 1.5);
  const p = run(at(0, 0, 1), keys({ forward: true }), 0.3, [crate]);
  run(p, keys({ forward: true, jump: true }), STEP, [crate]);
  run(p, keys({ forward: true }), 1, [crate]);
  check("can't jump onto a 1.5 m box", round(p.pos[1]), 0);
}
{
  let peak = 0;
  const p = run(at(0, 0, 0), keys({ jump: true }), STEP);
  run(p, NONE, 1, [], q => { peak = Math.max(peak, q.pos[1]); });
  check("jump height about 1 m", peak > 0.9 && peak < 1.05, true);
}
{
  let peak = 0;
  const ceiling = box(0, 0, 4, 4, 1, { y: 2.2 });
  const p = run(at(0, 0, 0), keys({ jump: true }), STEP, [ceiling]);
  run(p, NONE, 1, [ceiling], q => { peak = Math.max(peak, q.pos[1] + q.height); });
  check("head bumps the ceiling", round(peak), 2.2);
}

// ─── Falling & landing ───────────────────────────────────────────────────────
{
  const p = at(0, 3, 0);
  p.onGround = false;
  run(p, NONE, 1.5);
  check("falls to the floor", [round(p.pos[1]), p.onGround], [0, true]);
}
{
  const p = at(0, 20, 0);
  p.onGround = false;
  run(p, NONE, 3, [box(0, 0, 2, 2, 0.4)]);
  check("lands on a thin box after a long fall", round(p.pos[1]), 0.4);
}
{
  // Walking down stairs follows the steps — never airborne.
  const flight = [...stairs(-3, 0, "+x", 3), box(1.5, 0, 3, 2, 1.2)]; // steps x -3..0, platform x 0..3
  const p = at(1.5, 1.2, 0, Math.PI / 2); // facing -x, down the stairs
  let airborne = 0;
  run(p, keys({ forward: true }), 1.2, flight, q => { if (!q.onGround) airborne++; });
  check("reaches the bottom of the stairs", round(p.pos[1]), 0);
  check("never airborne going downstairs", airborne, 0);
}
{
  const ledge = box(0, 0, 4, 4, 1.2);
  const p = at(0, 1.2, 0);
  let airborne = 0;
  run(p, keys({ forward: true }), 1.2, [ledge], q => { if (!q.onGround) airborne++; });
  check("walking off a 1.2 m ledge is a fall", [round(p.pos[1]), airborne > 5], [0, true]);
}

// ─── Crouching ───────────────────────────────────────────────────────────────
{
  const overhang = box(0, -3, 4, 2, 2, { y: 1.4 }); // underside at 1.4
  const p = run(at(0, 0, 0), keys({ forward: true }), 1, [overhang]);
  check("standing body can't pass under 1.4 m", p.pos[2] > -1.61, true);

  const q = run(at(0, 0, 0), keys({ forward: true, crouch: true }), 1.3, [overhang]);
  check("crouching passes under", q.pos[2] < -2.5, true);
  run(q, NONE, 0.1, [overhang]);
  check("can't stand up under it", q.height, CROUCH_HEIGHT);
  run(q, keys({ forward: true, crouch: true }), 2, [overhang]);
  run(q, NONE, 0.1, [overhang]);
  check("stands up once clear", q.height, BODY_HEIGHT);
}

// ─── Random play on every real map ───────────────────────────────────────────
// A minute of random keys and turning per spawn: the body must never end up
// inside a box or outside the map.
{
  let seed = 12345;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (const map of MAPS) {
    let bad = 0;
    for (const s of map.playerSpawns) {
      const p = createPlayer(s);
      let input = NONE;
      for (let i = 0; i < 60 / STEP; i++) {
        if (i % 20 === 0) {
          input = keys({ forward: rand() < 0.7, back: rand() < 0.1, left: rand() < 0.3, right: rand() < 0.3, sprint: rand() < 0.5, crouch: rand() < 0.1 });
          p.yaw += (rand() - 0.5) * 2;
        }
        stepPlayer(p, { ...input, jump: rand() < 0.02 }, STEP, map.boxes);
        const inside = overlapsAny(bodyBox(p.pos, { height: p.height }), map.boxes);
        const out = Math.abs(p.pos[0]) > map.size[0] / 2 || Math.abs(p.pos[2]) > map.size[1] / 2 || p.pos[1] < 0;
        if (inside || out) bad++;
      }
    }
    check(`${map.id}: never inside a box or out of bounds`, bad, 0);
  }
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll player checks passed");
