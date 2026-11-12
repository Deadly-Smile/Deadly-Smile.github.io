// ─── Health, hitboxes and damage ────────────────────────────────────────────
// Everything that can be hurt is an "actor": { id, team, pos (feet), yaw,
// height, health }. The player, training dummies and (FPS-6) bots all use
// the same shape, so the same rules apply to all of them.
//
// Pure: no three.js/DOM. Health objects are mutated in place.
import { segmentHitsBox, lineOfSight } from "./geometry.js";
import { damageAt } from "./weapons.js";

export const MAX_HP = 100;
export const REGEN_DELAY = 5;    // s without taking damage before healing starts
export const REGEN_RATE = 15;    // hp/s while healing

// Hitboxes follow the character models (realistic proportions): the head
// from the neck — HEAD_FROM of the body's height — to the top, the body
// below it. Both are a little narrower than what's drawn, so shots that
// graze an outline (helmet edge, elbows) don't count.
export const HITBOX_RADIUS = 0.26;
export const HEAD_FROM = 0.81;
export const HEAD_RADIUS = 0.13;
// Where bots aim: the middle of the chest.
export const TORSO_CENTRE = 0.62;

export function createHealth(max = MAX_HP) {
  return { hp: max, max, sinceHit: Infinity, dead: false };
}

// Returns { dealt, killed }. Dead actors take nothing.
export function applyDamage(h, amount) {
  if (h.dead || amount <= 0) return { dealt: 0, killed: false };
  const dealt = Math.min(h.hp, amount);
  h.hp -= dealt;
  h.sinceHit = 0;
  if (h.hp <= 0) {
    h.hp = 0;
    h.dead = true;
    return { dealt, killed: true };
  }
  return { dealt, killed: false };
}

// Regeneration: nothing until REGEN_DELAY has passed since the last hit.
export function stepHealth(h, dt) {
  if (h.dead) return;
  h.sinceHit += dt;
  if (h.sinceHit >= REGEN_DELAY && h.hp < h.max) h.hp = Math.min(h.max, h.hp + REGEN_RATE * dt);
}

export function revive(h) {
  h.hp = h.max;
  h.dead = false;
  h.sinceHit = Infinity;
}

// Head on top, body below it, both centred on the actor's feet position and
// scaled with its current height (a crouched head sits lower).
export function hitboxes(actor) {
  const [x, y, z] = actor.pos;
  const top = y + actor.height;
  const neck = y + actor.height * HEAD_FROM;
  const r = HITBOX_RADIUS;
  const hr = HEAD_RADIUS;
  return [
    { part: "head", box: { min: [x - hr, neck, z - hr], max: [x + hr, top, z + hr] } },
    { part: "body", box: { min: [x - r, y, z - r], max: [x + r, neck, z + r] } },
  ];
}

// Nearest actor hit by the segment p0→p1: { t, actor, part } or null.
// Dead actors and the shooter (`ignoreId`) are skipped.
export function raycastActors(p0, p1, actors, ignoreId) {
  let best = null;
  for (const actor of actors) {
    if (actor.id === ignoreId || actor.health.dead) continue;
    for (const { part, box } of hitboxes(actor)) {
      const t = segmentHitsBox(p0, p1, box);
      if (t !== null && (best === null || t < best.t)) best = { t, actor, part };
    }
  }
  return best;
}

// One pellet/bullet hitting `part` at `distance` metres. `maxHeadshot` caps
// the head multiplier (bots use it).
export function shotDamage(weapon, distance, part, maxHeadshot = Infinity) {
  return damageAt(weapon, distance) * (part === "head" ? Math.min(weapon.headshot ?? 1, maxHeadshot) : 1);
}

// Knife: double (weapon.backstab) damage when the attacker faces roughly the
// same way as the victim, i.e. hits them from behind.
export function meleeDamage(weapon, attackerYaw, victimYaw) {
  const diff = Math.abs(Math.atan2(Math.sin(attackerYaw - victimYaw), Math.cos(attackerYaw - victimYaw)));
  return diff < Math.PI / 3 ? weapon.damage * (weapon.backstab ?? 1) : weapon.damage;
}

// Grenade blast at `center`: every living actor within `radius` (measured to
// the nearest point of their body) that the blast can "see" — a straight line
// from the centre to their feet, chest or head not blocked by the map —
// takes damage falling off linearly from `maxDamage` at the centre to 0 at
// the edge. Returns [{ actor, amount }].
export function explosionDamage(center, radius, maxDamage, actors, boxes) {
  const out = [];
  const c = [center[0], center[1] + 0.1, center[2]];
  for (const actor of actors) {
    if (actor.health.dead) continue;
    const [x, y, z] = actor.pos;
    const r = HITBOX_RADIUS;
    const nearest = [
      Math.max(x - r, Math.min(c[0], x + r)),
      Math.max(y, Math.min(c[1], y + actor.height)),
      Math.max(z - r, Math.min(c[2], z + r)),
    ];
    const d = Math.hypot(nearest[0] - c[0], nearest[1] - c[1], nearest[2] - c[2]);
    if (d >= radius) continue;
    const visible = [0.2, actor.height * 0.6, actor.height - 0.1]
      .some(h => lineOfSight(c, [x, y + h, z], boxes));
    if (!visible) continue;
    out.push({ actor, amount: maxDamage * (1 - d / radius) });
  }
  return out;
}
