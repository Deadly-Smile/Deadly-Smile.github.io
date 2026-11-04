// ─── Weapons ────────────────────────────────────────────────────────────────
// Every number that defines a weapon lives in WEAPONS; the logic below only
// reads the table. A loadout has four slots:
//   0 primary (SMG / rifle / sniper / shotgun), 1 pistol, 2 knife, 3 grenades.
//
// stepWeapons() runs once per simulation tick and returns what happened as
// events ("shot", "melee", "throw", "reload", …) plus a view kick (recoil).
// It knows nothing about the world: the caller turns a shot's direction
// offsets into rays, applies damage (FPS-5) and draws effects.
//
// Pure: no three.js/DOM. Mutates the loadout in place. `rand` is injectable
// so tests are deterministic.

// Spread values are cone radii in radians. Damage falls off linearly from
// falloff[0] m to falloff[1] m, down to falloff[2] × damage.
export const WEAPONS = {
  smg: {
    id: "smg", name: "SMG", slot: 0, kind: "gun", auto: true,
    damage: 20, pellets: 1, rpm: 850, mag: 30, reserve: 120, reload: 1.8, draw: 0.3,
    spread: { hip: 0.045, ads: 0.016, move: 0.03, air: 0.08 }, bloom: 0.005, bloomMax: 0.035,
    recoil: { pitch: 0.008, yaw: 0.006 }, range: 60, falloff: [12, 35, 0.55], adsZoom: 0.85,
  },
  rifle: {
    id: "rifle", name: "Assault Rifle", slot: 0, kind: "gun", auto: true,
    damage: 28, pellets: 1, rpm: 600, mag: 30, reserve: 90, reload: 2.2, draw: 0.4,
    spread: { hip: 0.035, ads: 0.006, move: 0.035, air: 0.09 }, bloom: 0.005, bloomMax: 0.035,
    recoil: { pitch: 0.012, yaw: 0.005 }, range: 100, falloff: [30, 70, 0.7], adsZoom: 0.75,
  },
  sniper: {
    id: "sniper", name: "Sniper Rifle", slot: 0, kind: "gun", auto: false,
    damage: 95, pellets: 1, rpm: 45, mag: 5, reserve: 20, reload: 3, draw: 0.6,
    spread: { hip: 0.09, ads: 0.0005, move: 0.06, air: 0.15 }, bloom: 0, bloomMax: 0,
    recoil: { pitch: 0.06, yaw: 0.01 }, range: 200, falloff: [200, 200, 1], adsZoom: 0.25, scope: true,
  },
  shotgun: {
    id: "shotgun", name: "Shotgun", slot: 0, kind: "gun", auto: false,
    damage: 14, pellets: 9, rpm: 70, mag: 6, reserve: 24, reload: 2.6, draw: 0.45,
    spread: { hip: 0.09, ads: 0.065, move: 0.02, air: 0.04 }, bloom: 0, bloomMax: 0,
    recoil: { pitch: 0.05, yaw: 0.012 }, range: 40, falloff: [6, 20, 0.2], adsZoom: 0.85,
  },
  pistol: {
    id: "pistol", name: "Pistol", slot: 1, kind: "gun", auto: false,
    damage: 25, pellets: 1, rpm: 300, mag: 12, reserve: 48, reload: 1.5, draw: 0.25,
    spread: { hip: 0.025, ads: 0.008, move: 0.02, air: 0.06 }, bloom: 0.006, bloomMax: 0.03,
    recoil: { pitch: 0.018, yaw: 0.004 }, range: 60, falloff: [15, 40, 0.6], adsZoom: 0.85,
  },
  knife: {
    id: "knife", name: "Knife", slot: 2, kind: "melee",
    damage: 55, rpm: 110, range: 1.8, draw: 0.2,
  },
  grenade: {
    id: "grenade", name: "Grenade", slot: 3, kind: "throw",
    damage: 110, rpm: 70, count: 2, max: 3, draw: 0.3,
    throwSpeed: 15, fuse: 2.5, radius: 6,
  },
};

export const PRIMARIES = ["smg", "rifle", "sniper", "shotgun"];
export const DEFAULT_PRIMARY = "rifle";

// Bloom (extra spread from sustained fire) drains at this rate (rad/s) once
// the trigger is released.
const BLOOM_DECAY = 0.12;
// Recoil pitch returns at this rate (rad/s) once the trigger is released.
const RECOIL_RECOVERY = 0.35;
// Fraction of each shot's pitch kick that is later recovered.
const RECOVERABLE = 0.6;

export function createLoadout(primaryId = DEFAULT_PRIMARY) {
  const primary = WEAPONS[primaryId]?.slot === 0 ? primaryId : DEFAULT_PRIMARY;
  const ammo = {};
  for (const id of [primary, "pistol"]) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  ammo.grenade = { mag: WEAPONS.grenade.count, reserve: 0 };
  return {
    slots: [primary, "pistol", "knife", "grenade"],
    active: 0,
    previous: 1,
    ammo,
    cooldown: 0,     // s until the active weapon may fire again
    reloading: 0,    // s left on a reload in progress
    switching: 0,    // s left drawing the active weapon
    triggerHeld: false,
    ads: false,
    bloom: 0,
    recoilDebt: 0,   // pitch kick still to be recovered (rad)
    firedThisTick: false,
  };
}

export const activeWeapon = (l) => WEAPONS[l.slots[l.active]];

// Direction offsets for one pellet: uniform over a cone of radius `spread`.
function coneOffset(spread, rand) {
  const r = spread * Math.sqrt(rand());
  const a = rand() * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// Current spread of the active gun. ctx: { speedFrac (0..1+), airborne }.
export function currentSpread(l, ctx = {}) {
  const w = activeWeapon(l);
  if (w.kind !== "gun") return 0;
  const s = w.spread;
  return (l.ads ? s.ads : s.hip)
    + s.move * Math.min(1, ctx.speedFrac ?? 0) * (l.ads ? 0.5 : 1)
    + (ctx.airborne ? s.air : 0)
    + l.bloom;
}

// Damage of one pellet/hit at `distance` metres (falloff only; headshots and
// armour are FPS-5's business).
export function damageAt(w, distance) {
  const [start, end, minFrac] = w.falloff ?? [Infinity, Infinity, 1];
  if (distance <= start) return w.damage;
  if (distance >= end) return w.damage * minFrac;
  return w.damage * (1 - (1 - minFrac) * (distance - start) / (end - start));
}

function canSelect(l, slot) {
  const id = l.slots[slot];
  return !!id && (id !== "grenade" || l.ammo.grenade.mag > 0);
}

function selectSlot(l, slot, events) {
  if (slot === l.active || !canSelect(l, slot)) return;
  l.previous = l.active;
  l.active = slot;
  l.switching = activeWeapon(l).draw;
  l.reloading = 0;
  l.ads = false;
  l.cooldown = 0;
  l.bloom = 0;
  events.push({ type: "switch", weapon: activeWeapon(l).id });
}

function startReload(l, events) {
  const w = activeWeapon(l);
  const a = l.ammo[w.id];
  if (w.kind !== "gun" || l.reloading > 0 || l.switching > 0 || a.mag >= w.mag || a.reserve <= 0) return;
  l.reloading = w.reload;
  l.ads = false;
  events.push({ type: "reload", weapon: w.id, duration: w.reload });
}

// input: { fire (held), ads (held), reload (pressed), slot (index pressed or
// null), scroll (+1/-1/0), lastWeapon (pressed) }
// ctx: { speedFrac, airborne } — for spread.
// Returns { events, kick: [yaw, pitch] } — kick is added to the view (pitch
// positive = up).
export function stepWeapons(l, input, dt, ctx = {}, rand = Math.random) {
  const events = [];
  let kickYaw = 0;
  let kickPitch = 0;

  // A running cooldown may go slightly negative so the leftover carries into
  // the next shot — otherwise every interval rounds up to whole ticks and an
  // 850 rpm gun fires at 720. It's reset below if the gun doesn't fire.
  l.cooldown = l.cooldown > 0 ? l.cooldown - dt : 0;
  l.switching = Math.max(0, l.switching - dt);
  if (!input.fire) l.bloom = Math.max(0, l.bloom - BLOOM_DECAY * dt);

  // Weapon selection.
  if (input.slot != null) selectSlot(l, input.slot, events);
  else if (input.lastWeapon) selectSlot(l, l.previous, events);
  else if (input.scroll) {
    for (let i = 1; i < l.slots.length; i++) {
      const slot = (l.active + input.scroll * i + l.slots.length * 4) % l.slots.length;
      if (canSelect(l, slot)) {
        selectSlot(l, slot, events);
        break;
      }
    }
  }

  const w = activeWeapon(l);
  const ammo = l.ammo[w.id];

  // Reload in progress.
  if (l.reloading > 0) {
    l.reloading -= dt;
    if (l.reloading <= 0) {
      l.reloading = 0;
      const take = Math.min(w.mag - ammo.mag, ammo.reserve);
      ammo.mag += take;
      ammo.reserve -= take;
      events.push({ type: "reloaded", weapon: w.id });
    }
  }
  if (input.reload) startReload(l, events);

  const busy = l.reloading > 0 || l.switching > 0;
  l.ads = w.kind === "gun" && !!input.ads && !busy;

  const pressed = input.fire && !l.triggerHeld;
  l.triggerHeld = !!input.fire;
  // Automatic guns and the knife fire while held; everything else per click.
  const wantsFire = (w.kind === "gun" && w.auto) || w.kind === "melee" ? input.fire : pressed;
  l.firedThisTick = false;

  if (wantsFire && !busy && l.cooldown <= 1e-9) {
    const interval = 60 / w.rpm;
    if (w.kind === "gun") {
      if (ammo.mag > 0) {
        const spread = currentSpread(l, ctx);
        const pellets = [];
        for (let i = 0; i < w.pellets; i++) pellets.push(coneOffset(spread, rand));
        ammo.mag--;
        l.cooldown += interval;
        l.bloom = Math.min(w.bloomMax, l.bloom + w.bloom);
        l.firedThisTick = true;
        kickPitch = w.recoil.pitch * (0.85 + rand() * 0.3);
        kickYaw = w.recoil.yaw * (rand() * 2 - 1);
        l.recoilDebt += kickPitch * RECOVERABLE;
        events.push({ type: "shot", weapon: w.id, pellets, spread });
        if (ammo.mag === 0) startReload(l, events);
      } else if (pressed) {
        events.push({ type: "empty", weapon: w.id });
        startReload(l, events);
      }
    } else if (w.kind === "melee") {
      l.cooldown += interval;
      events.push({ type: "melee", weapon: w.id, range: w.range });
    } else if (w.kind === "throw" && ammo.mag > 0) {
      ammo.mag--;
      l.cooldown += interval;
      events.push({ type: "throw", weapon: w.id });
      if (ammo.mag === 0) selectSlot(l, l.previous === l.active ? 0 : l.previous, events);
    }
  }

  if (l.cooldown < 0 && !l.firedThisTick) l.cooldown = 0;

  // Let the view drift back down once the trigger is released.
  if (!input.fire && l.recoilDebt > 0) {
    const back = Math.min(l.recoilDebt, RECOIL_RECOVERY * dt);
    l.recoilDebt -= back;
    kickPitch -= back;
  }

  return { events, kick: [kickYaw, kickPitch] };
}
