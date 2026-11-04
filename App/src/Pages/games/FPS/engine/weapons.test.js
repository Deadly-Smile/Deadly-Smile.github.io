// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising weapons, grenades and world raycasts. Run with:
//   node src/Pages/games/FPS/engine/weapons.test.js
import { WEAPONS, PRIMARIES, createLoadout, stepWeapons, activeWeapon, currentSpread, damageAt } from "./weapons.js";
import { createGrenade, stepGrenade } from "./projectile.js";
import { raycastWorld, bodyBox, overlapsAny } from "./geometry.js";
import { box } from "../maps/build.js";
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

const IDLE = { fire: false, ads: false, reload: false, slot: null, scroll: 0, lastWeapon: false };
const inp = (o) => ({ ...IDLE, ...o });
// Deterministic "random" in [0, 1).
const seq = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// Runs `seconds` of ticks with the same input; collects every event.
function run(l, input, seconds, ctx) {
  const events = [];
  const rand = seq();
  let kickPitch = 0;
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    const r = stepWeapons(l, input, STEP, ctx, rand);
    events.push(...r.events);
    kickPitch += r.kick[1];
  }
  return { events, kickPitch, count: (type) => events.filter(e => e.type === type).length };
}
const tick = (l, input) => stepWeapons(l, input, STEP, {}, seq());

// ─── Table ───────────────────────────────────────────────────────────────────
for (const [id, w] of Object.entries(WEAPONS)) {
  const ok = w.id === id && w.rpm > 0 && w.draw > 0
    && (w.kind !== "gun" || (w.mag > 0 && w.reserve >= 0 && w.reload > 0 && w.pellets >= 1 && w.spread.ads <= w.spread.hip));
  check(`table entry ${id} is complete`, ok, true);
}
check("primaries are slot 0", PRIMARIES.every(id => WEAPONS[id].slot === 0), true);
check("unknown primary falls back", createLoadout("banana").slots[0], "rifle");
check("loadout slots", createLoadout("smg").slots, ["smg", "pistol", "knife", "grenade"]);

// ─── Fire rate ───────────────────────────────────────────────────────────────
{
  const l = createLoadout("smg");
  const r = run(l, inp({ fire: true }), 1);
  // First shot at t = 0, then one every 60/rpm s; the last tick is at 59/60 s.
  check("auto fire follows rpm", r.count("shot"), Math.floor((59 / 60) / (60 / WEAPONS.smg.rpm)) + 1);
  check("ammo spent", l.ammo.smg.mag, WEAPONS.smg.mag - r.count("shot"));
}
{
  const l = createLoadout("sniper");
  check("semi-auto: holding fires once", run(l, inp({ fire: true }), 3).count("shot"), 1);
  const l2 = createLoadout("pistol");
  l2.active = 1;
  let shots = 0;
  for (let i = 0; i < 60; i++) shots += tick(l2, inp({ fire: i % 2 === 0 })).events.filter(e => e.type === "shot").length;
  // Clicking every other tick (30 clicks/s) is capped by 300 rpm: t = 0, 0.2 … 0.8.
  check("semi-auto: clicking is still capped by rpm", shots, 5);
}
{
  const l = createLoadout("shotgun");
  const r = run(l, inp({ fire: true }), STEP);
  check("shotgun fires 9 pellets per shot", r.events.find(e => e.type === "shot").pellets.length, 9);
  check("one shell per shot", l.ammo.shotgun.mag, WEAPONS.shotgun.mag - 1);
}

// ─── Reloading ───────────────────────────────────────────────────────────────
{
  const l = createLoadout("rifle");
  const w = WEAPONS.rifle;
  const r = run(l, inp({ fire: true }), 4);
  check("empty magazine auto-reloads", r.count("reload") >= 1, true);
  run(l, IDLE, w.reload + 0.1);
  check("reload refills the magazine", l.ammo.rifle.mag, w.mag);
  check("reserve pays for it", l.ammo.rifle.reserve, w.reserve - w.mag);
}
{
  const l = createLoadout("rifle");
  l.ammo.rifle.mag = 10;
  l.ammo.rifle.reserve = 5;
  run(l, inp({ reload: true }), STEP);
  run(l, IDLE, 3);
  check("partial reserve: tops up what it can", [l.ammo.rifle.mag, l.ammo.rifle.reserve], [15, 0]);
}
{
  const l = createLoadout("rifle");
  check("no reload with a full magazine", run(l, inp({ reload: true }), STEP).count("reload"), 0);
  l.ammo.rifle.mag = 0;
  l.ammo.rifle.reserve = 0;
  const r = run(l, inp({ fire: true }), 0.5);
  check("no ammo at all: click, no shot, no reload", [r.count("empty"), r.count("shot"), r.count("reload")], [1, 0, 0]);
}
{
  const l = createLoadout("rifle");
  l.ammo.rifle.mag = 5;
  run(l, inp({ reload: true }), STEP);
  check("can't fire while reloading", run(l, inp({ fire: true }), 1).count("shot"), 0);
  check("can't aim while reloading", l.ads, false);
}

// ─── Switching ───────────────────────────────────────────────────────────────
{
  const l = createLoadout("rifle");
  l.ammo.rifle.mag = 5;
  run(l, inp({ reload: true }), STEP);
  tick(l, inp({ slot: 1 }));
  check("switching cancels a reload", [activeWeapon(l).id, l.reloading], ["pistol", 0]);
  check("magazine untouched by the cancelled reload", l.ammo.rifle.mag, 5);
  check("can't fire during the draw", run(l, inp({ fire: true }), WEAPONS.pistol.draw - 0.05).count("shot"), 0);
  run(l, IDLE, 0.1);
  check("fires once drawn", run(l, inp({ fire: true }), 0.1).count("shot"), 1);
}
{
  const l = createLoadout("rifle");
  tick(l, inp({ scroll: 1 }));
  check("scroll down goes to the next slot", l.active, 1);
  tick(l, inp({ scroll: -1 }));
  check("scroll up goes back", l.active, 0);
  tick(l, inp({ slot: 2 }));
  tick(l, inp({ lastWeapon: true }));
  check("Q swaps to the previous weapon", l.active, 0);
  l.ammo.grenade.mag = 0;
  tick(l, inp({ scroll: -1 }));
  check("scroll skips grenades when out of them", l.active, 2);
  tick(l, inp({ slot: 3 }));
  check("can't select grenades when out of them", l.active, 2);
}

// ─── Knife & grenades ────────────────────────────────────────────────────────
{
  const l = createLoadout("rifle");
  tick(l, inp({ slot: 2 }));
  run(l, IDLE, 0.5);
  const r = run(l, inp({ fire: true }), 1);
  check("knife swings at its own rate, holding allowed", r.count("melee"), 2);
}
{
  const l = createLoadout("rifle");
  tick(l, inp({ slot: 3 }));
  run(l, IDLE, 0.5);
  let r = run(l, inp({ fire: true }), STEP);
  check("throw uses one grenade", [r.count("throw"), l.ammo.grenade.mag], [1, 1]);
  run(l, IDLE, 1);
  r = run(l, inp({ fire: true }), STEP);
  check("last grenade thrown → back to the previous weapon", [r.count("throw"), l.ammo.grenade.mag, l.active], [1, 0, 0]);
}

// ─── Spread, recoil, damage ──────────────────────────────────────────────────
{
  const l = createLoadout("rifle");
  const hip = currentSpread(l);
  l.ads = true;
  check("aiming tightens spread", currentSpread(l) < hip, true);
  l.ads = false;
  check("moving widens spread", currentSpread(l, { speedFrac: 1 }) > hip, true);
  check("jumping widens it more", currentSpread(l, { airborne: true }) > currentSpread(l, { speedFrac: 1 }), true);

  const r = run(l, inp({ fire: true, ads: true }), 0.5);
  const shots = r.events.filter(e => e.type === "shot");
  check("every pellet is within its shot's cone", shots.every(s => s.pellets.every(([a, b]) => Math.hypot(a, b) <= s.spread + 1e-12)), true);
  check("sustained fire blooms", shots.at(-1).spread > shots[0].spread, true);
  check("recoil kicks the view up", r.kickPitch > 0, true);
  const settled = r.kickPitch + run(l, IDLE, 2).kickPitch;
  check("part of the kick recovers after firing stops", settled < r.kickPitch * 0.5, true);
}
{
  const w = WEAPONS.rifle;
  check("full damage up close", damageAt(w, 5), w.damage);
  check("falloff floor at long range", damageAt(w, 500), w.damage * w.falloff[2]);
  check("between: linear", +damageAt(w, 50).toFixed(3), +(w.damage * (1 - 0.3 * 0.5)).toFixed(3));
}

// ─── World raycast ───────────────────────────────────────────────────────────
{
  const wall = box(0, -5, 10, 1, 3); // z -5.5..-4.5
  const hit = raycastWorld([0, 1.5, 0], [0, 1.5, -100], [wall]);
  check("ray hits the wall's near face", [hit.index, hit.point[2], hit.normal], [0, -4.5, [0, 0, 1]]);
  const down = raycastWorld([0, 1.5, 0], [0, -1.5, -3], []);
  check("ray hits the floor", [down.index, down.normal, +down.point[2].toFixed(3)], [-1, [0, 1, 0], -1.5]);
  const top = raycastWorld([0, 10, -5], [0, -10, -5], [wall]);
  check("ray from above hits the top face", [top.index, top.point[1], top.normal], [0, 3, [0, 1, 0]]);
  check("ray into the sky misses", raycastWorld([0, 1.5, 0], [0, 50, -10], [wall]), null);
}

// ─── Grenade flight ──────────────────────────────────────────────────────────
{
  const g = createGrenade([0, 1.5, 0], [0, 0.3, -0.954], 15, 2.5);
  let ticks = 0;
  while (!stepGrenade(g, STEP, []) && ticks < 1000) ticks++;
  check("fuse goes off on time", ticks, Math.round(2.5 / STEP) - 1);
  check("lands and stops on the floor", [g.resting, +g.pos[1].toFixed(2)], [true, 0.08]);
}
{
  const wall = box(0, -5, 10, 1, 3);
  const g = createGrenade([0, 1.5, 0], [0, 0, -1], 20, 3);
  let crossed = false;
  for (let i = 0; i < 180; i++) {
    stepGrenade(g, STEP, [wall]);
    if (g.pos[2] < -4.5) crossed = true;
  }
  check("bounces off a wall instead of passing through", crossed, false);
  check("came back toward the thrower", g.pos[2] > -4.5, true);
}
{
  const crate = box(0, -3, 2, 2, 1);
  const g = createGrenade([0, 3, -3], [0, -1, 0], 2, 3);
  for (let i = 0; i < 150; i++) stepGrenade(g, STEP, [crate]);
  check("lands on top of a crate", [g.resting, +g.pos[1].toFixed(2)], [true, 1.08]);
  check("not inside the crate", overlapsAny(bodyBox(g.pos, { radius: 0.07, height: 0.01 }), [crate]), false);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll weapon checks passed");
