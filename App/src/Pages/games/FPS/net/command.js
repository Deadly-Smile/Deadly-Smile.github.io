// ─── Applying one command ───────────────────────────────────────────────────
// The single step both sides run for every command: the host to decide what
// really happened, the guest to predict it. Same inputs, same code, same
// "random" numbers (seeded by the command's number, so the host draws the
// same bullet spread the guest already showed) → the same result.
// Also the conversions between a loadout and its form in a snapshot.
// Pure: no PeerJS/DOM.
import { stepPlayer, MAX_PITCH, CROUCH_HEIGHT, WALK_SPEED } from "../engine/player.js";
import { BODY_HEIGHT } from "../engine/geometry.js";
import { stepWeapons, createLoadout, WEAPONS } from "../engine/weapons.js";
import { STEP } from "../engine/loop.js";

const NOTHING = { events: [], kick: [0, 0] };

// Small deterministic generator (mulberry32) for one command's randomness.
export function seededRand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// p: { id, body, loadout, dead }. Moves the body and runs the weapon for one
// tick; returns stepWeapons()' { events, kick }. The dead don't act.
export function runCommand(p, cmd, boxes) {
  const { body, loadout } = p;
  body.yaw = cmd.yaw;
  body.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, cmd.pitch));
  if (p.dead) return NOTHING;
  stepPlayer(body, { ...cmd.input, ads: loadout.ads }, STEP, boxes);
  const ctx = { speedFrac: Math.hypot(body.vel[0], body.vel[2]) / WALK_SPEED, airborne: !body.onGround };
  return stepWeapons(loadout, cmd.weapon, STEP, ctx, seededRand(cmd.seq * 2654435761 + p.id));
}

// Unit vector for a view direction (yaw 0 = -z, pitch up positive).
export function direction(yaw, pitch) {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

// Overwrite a body with authoritative state.
export function setBody(body, s) {
  body.pos = [...s.pos];
  body.prev = [...s.pos];
  body.vel = [...s.vel];
  body.onGround = s.onGround;
  body.crouched = s.crouched;
  body.height = s.crouched ? CROUCH_HEIGHT : BODY_HEIGHT;
}

// A loadout as it travels in a snapshot.
export function loadoutState(l) {
  const primary = l.slots[0];
  return {
    primary, active: l.active, previous: l.previous,
    ammo: {
      primary: [l.ammo[primary].mag, l.ammo[primary].reserve],
      pistol: [l.ammo.pistol.mag, l.ammo.pistol.reserve],
      grenades: l.ammo.grenade.mag,
    },
    cooldown: l.cooldown, reloading: l.reloading, switching: l.switching,
    bloom: l.bloom, recoilDebt: l.recoilDebt, triggerHeld: l.triggerHeld, ads: l.ads,
  };
}

// Overwrite a loadout with one from a snapshot.
export function setLoadout(l, s) {
  const primary = WEAPONS[s.primary]?.slot === 0 ? s.primary : l.slots[0];
  if (primary !== l.slots[0]) {
    delete l.ammo[l.slots[0]];
    l.slots[0] = primary;
  }
  l.ammo[primary] = { mag: s.ammo.primary[0], reserve: s.ammo.primary[1] };
  l.ammo.pistol = { mag: s.ammo.pistol[0], reserve: s.ammo.pistol[1] };
  l.ammo.grenade = { mag: s.ammo.grenades, reserve: 0 };
  l.active = s.active;
  l.previous = s.previous;
  l.cooldown = s.cooldown;
  l.reloading = s.reloading;
  l.switching = s.switching;
  l.bloom = s.bloom;
  l.recoilDebt = s.recoilDebt;
  l.triggerHeld = s.triggerHeld;
  l.ads = s.ads;
}

export { createLoadout };
