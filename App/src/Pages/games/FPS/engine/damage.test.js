// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising health, hitboxes and damage rules. Run with:
//   node src/Pages/games/FPS/engine/damage.test.js
import {
  createHealth, applyDamage, stepHealth, revive, hitboxes, raycastActors,
  shotDamage, meleeDamage, explosionDamage, REGEN_DELAY, REGEN_RATE, MAX_HP, HEAD_FROM, HITBOX_RADIUS,
} from "./damage.js";
import { WEAPONS, damageAt } from "./weapons.js";
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
const round = (v, d = 3) => +v.toFixed(d);
const actor = (id, x, z, extra = {}) => ({ id, team: "x", pos: [x, 0, z], yaw: 0, height: 1.8, health: createHealth(), ...extra });
const tick = (h, seconds) => { for (let i = 0; i < Math.round(seconds / STEP); i++) stepHealth(h, STEP); };

// ─── Health & regeneration ───────────────────────────────────────────────────
{
  const h = createHealth();
  check("starts full", h.hp, MAX_HP);
  check("damage", [applyDamage(h, 30), h.hp], [{ dealt: 30, killed: false }, 70]);
  tick(h, REGEN_DELAY - 0.5);
  check("no healing before the delay", h.hp, 70);
  tick(h, 1);
  check("heals after the delay", h.hp > 70 && h.hp < 70 + REGEN_RATE, true);
  tick(h, 10);
  check("heals up to max, not past it", h.hp, MAX_HP);

  applyDamage(h, 50);
  tick(h, REGEN_DELAY - 1);
  applyDamage(h, 1);
  tick(h, REGEN_DELAY - 1);
  check("a new hit restarts the delay", h.hp, 49);
}
{
  const h = createHealth();
  check("overkill only deals what's left", applyDamage(h, 250), { dealt: 100, killed: true });
  check("dead", [h.hp, h.dead], [0, true]);
  check("the dead take no more damage", applyDamage(h, 10), { dealt: 0, killed: false });
  tick(h, 20);
  check("the dead don't regenerate", h.hp, 0);
  revive(h);
  check("revive restores full health", [h.hp, h.dead], [MAX_HP, false]);
}

// ─── Hitboxes & rays ─────────────────────────────────────────────────────────
{
  const a = actor("a", 0, -10);
  const [head, body] = hitboxes(a);
  check("head from the neck to the top", [head.part, round(head.box.min[1]), head.box.max[1]], ["head", round(1.8 * HEAD_FROM), 1.8]);
  check("body below the head", [body.part, body.box.min[1], round(body.box.max[1])], ["body", 0, round(1.8 * HEAD_FROM)]);

  const eye = [0, 1.6, 0];
  check("ray at head height hits the head", raycastActors(eye, [0, 1.6, -100], [a]).part, "head");
  check("ray at chest height hits the body", raycastActors(eye, [0, 1.0, -10], [a])?.part, "body");
  check("ray beside them misses", raycastActors(eye, [5, 1.6, -100], [a]), null);

  const near = actor("near", 0, -5);
  check("nearest actor is hit first", raycastActors(eye, [0, 1.2, -100], [a, near]).actor.id, "near");
  check("the shooter is ignored", raycastActors(eye, [0, 1.2, -100], [near, a], "near").actor.id, "a");
  near.health.dead = true;
  check("dead actors are ignored", raycastActors(eye, [0, 1.2, -100], [near, a]).actor.id, "a");

  const crouched = actor("c", 0, -10, { height: 1.2 });
  check("a crouched actor's head is lower", raycastActors(eye, [0, 1.6, -100], [crouched]), null);
}

// ─── Weapon damage ───────────────────────────────────────────────────────────
{
  const w = WEAPONS.rifle;
  check("body shot = falloff damage", shotDamage(w, 10, "body"), damageAt(w, 10));
  check("headshot multiplier", shotDamage(w, 10, "head"), w.damage * w.headshot);
  check("headshots fall off too", round(shotDamage(w, 200, "head")), round(w.damage * w.falloff[2] * w.headshot));
  check("sniper headshot kills", shotDamage(WEAPONS.sniper, 100, "head") >= MAX_HP, true);
  check("sniper body shot doesn't", shotDamage(WEAPONS.sniper, 100, "body") < MAX_HP, true);
  check("headshot multiplier can be capped", shotDamage(WEAPONS.sniper, 10, "head", 1.5), WEAPONS.sniper.damage * 1.5);
  const close = WEAPONS.shotgun.pellets * shotDamage(WEAPONS.shotgun, 3, "body");
  check("point-blank shotgun kills", close >= MAX_HP, true);
  check("long-range shotgun doesn't", WEAPONS.shotgun.pellets * shotDamage(WEAPONS.shotgun, 30, "body") < MAX_HP / 2, true);

  const k = WEAPONS.knife;
  check("knife from the front", meleeDamage(k, Math.PI, 0), k.damage);
  check("knife from behind (same facing) is a backstab", meleeDamage(k, 0.2, 0), k.damage * k.backstab);
  check("backstab kills", meleeDamage(k, 0, 0) >= MAX_HP, true);
  check("from the side isn't", meleeDamage(k, Math.PI / 2, 0), k.damage);
}

// ─── Explosions ──────────────────────────────────────────────────────────────
{
  const center = [0, 0.08, 0];
  const R = 6;
  const MAX = 110;
  const hits = (actors, boxes = []) => explosionDamage(center, R, MAX, actors, boxes).map(h => [h.actor.id, round(h.amount, 1)]);

  check("standing on it: nearly full damage", hits([actor("on", 0, 0)]), [["on", MAX]]);
  // The body's edge is HITBOX_RADIUS nearer than the actor's centre.
  check("falls off linearly with distance", hits([actor("mid", 3 + HITBOX_RADIUS, 0)]), [["mid", round(MAX * (1 - 3 / R), 1)]]);
  check("outside the radius: nothing", hits([actor("far", 6.5, 0)]), []);
  check("several at once", hits([actor("a", 1.33, 0), actor("b", 0, -4.33)]).length, 2);

  const wall = box(2, 0, 0.6, 6, 3); // x 1.7..2.3
  check("a wall blocks the blast", hits([actor("behind", 3.5, 0)], [wall]), []);
  const low = box(2, 0, 0.6, 6, 0.8);
  check("low cover doesn't shield your head", hits([actor("behindLow", 3.5, 0)], [low]).length, 1);
  const dead = actor("dead", 1, 0);
  dead.health.dead = true;
  check("the dead are skipped", hits([dead]), []);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll damage checks passed");
