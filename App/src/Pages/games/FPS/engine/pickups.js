// ─── Drops and pickups ──────────────────────────────────────────────────────
// A killed bot drops an ammo pack (always), sometimes its gun, and now and
// then a grenade. Walking over ammo or a grenade takes it if it's of any
// use; a gun is only swapped in on purpose (E), and the old primary is
// dropped in its place. Drops vanish after DROP_TTL. Pure.
import { WEAPONS } from "./weapons.js";

export const DROP_TTL = 25;          // s before a drop disappears
export const PICKUP_RADIUS = 1.3;    // m, walking over
export const GUN_DROP_CHANCE = 0.35;
export const GRENADE_DROP_CHANCE = 0.12;
// Reserve can't exceed this many times the weapon's starting reserve.
export const RESERVE_CAP = 2;

let nextId = 1;
const drop = (kind, pos, extra = {}) => ({ id: nextId++, kind, pos: [...pos], ttl: DROP_TTL, ...extra });

// Drops for a bot that died at `pos` carrying `primary` (a weapon id).
// Items are spread a little so they don't sit on top of each other.
export function rollDrops(pos, primary, rand = Math.random) {
  const at = (dx, dz) => [pos[0] + dx, pos[1], pos[2] + dz];
  const out = [drop("ammo", at(0, 0))];
  if (rand() < GUN_DROP_CHANCE && WEAPONS[primary]?.slot === 0) {
    const w = WEAPONS[primary];
    out.push(drop("gun", at(0.6, 0.3), { weapon: primary, mag: w.mag, reserve: w.mag }));
  }
  if (rand() < GRENADE_DROP_CHANCE) out.push(drop("grenade", at(-0.5, 0.4)));
  return out;
}

// Counts down every drop's timer; returns the ones still around.
export function stepDrops(drops, dt) {
  for (const d of drops) d.ttl -= dt;
  return drops.filter(d => d.ttl > 0);
}

export const nearDrop = (d, pos) => Math.hypot(d.pos[0] - pos[0], d.pos[2] - pos[2]) <= PICKUP_RADIUS
  && Math.abs(d.pos[1] - pos[1]) < 1.5;

// Adds reserve rounds for one gun, up to the cap. Returns rounds added.
export function addReserve(loadout, weaponId, rounds) {
  const a = loadout.ammo[weaponId];
  const w = WEAPONS[weaponId];
  if (!a || w.kind !== "gun") return 0;
  const before = a.reserve;
  a.reserve = Math.min(w.reserve * RESERVE_CAP, a.reserve + rounds);
  return a.reserve - before;
}

// Walk-over pickups (ammo, grenade). Returns a short description of what was
// taken, or null if it wasn't of any use (it then stays on the ground).
export function takeDrop(loadout, d) {
  if (d.kind === "ammo") {
    const primary = loadout.slots[0];
    const got = addReserve(loadout, primary, WEAPONS[primary].mag) + addReserve(loadout, "pistol", WEAPONS.pistol.mag);
    return got > 0 ? `+${got} ammo` : null;
  }
  if (d.kind === "grenade") {
    const g = loadout.ammo.grenade;
    if (g.mag >= WEAPONS.grenade.max) return null;
    g.mag++;
    return "+1 grenade";
  }
  return null;
}

// Swaps the loadout's primary for a dropped gun. Returns the drop to leave
// behind (the old primary, with its ammo), or null if it's the same gun —
// then its rounds are taken as ammo instead.
export function swapPrimary(loadout, d, pos) {
  const old = loadout.slots[0];
  if (d.weapon === old) {
    addReserve(loadout, old, d.mag + d.reserve);
    return null;
  }
  const oldAmmo = loadout.ammo[old];
  delete loadout.ammo[old];
  loadout.slots[0] = d.weapon;
  loadout.ammo[d.weapon] = { mag: d.mag, reserve: d.reserve };
  if (loadout.active === 0) {
    loadout.switching = WEAPONS[d.weapon].draw;
    loadout.reloading = 0;
    loadout.ads = false;
  }
  return drop("gun", pos, { weapon: old, mag: oldAmmo.mag, reserve: oldAmmo.reserve });
}
