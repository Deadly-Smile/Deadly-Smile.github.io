// ─── Single-player session ──────────────────────────────────────────────────
// Glue between the pure engine and the browser: feeds input into the
// simulation each tick, turns weapon events into rays/projectiles/damage/
// effects, and places the camera each frame. Grows with every ticket; for
// now it's a player with a full loadout and training dummies to shoot
// (FPS-6 replaces the dummies with bots).
import { createPlayer, stepPlayer, look, eyeHeight, WALK_SPEED } from "./engine/player.js";
import { createLoadout, stepWeapons, activeWeapon, WEAPONS } from "./engine/weapons.js";
import { createGrenade, stepGrenade } from "./engine/projectile.js";
import { raycastWorld, lineOfSight, bodyBox, overlapsAny, EYE_HEIGHT, BODY_HEIGHT } from "./engine/geometry.js";
import {
  createHealth, applyDamage, stepHealth, revive, raycastActors,
  shotDamage, meleeDamage, explosionDamage,
} from "./engine/damage.js";
import { buildNavGraph } from "./engine/nav.js";
import { createViewModel } from "./render/viewModel.js";
import { createEffects } from "./render/effects.js";
import { createDummyMeshes } from "./render/actors.js";

// Radians of turn per pixel of mouse movement at sensitivity 1.
const MOUSE_RADIANS_PER_PX = 0.0022;
// Grenades leave the hand a little above the aim line.
const THROW_LIFT = 0.18;
const PLAYER_RESPAWN_DELAY = 3;
const DUMMY_COUNT = 6;
const DUMMY_RESPAWN_DELAY = 4;
const HIT_FLASH = 0.15;
const BLOOD = 0xb91c1c;

// Unit vector for a view direction (yaw 0 = -z, pitch up positive).
function direction(yaw, pitch) {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

// Training dummies stand where the player can see them from `spawn`: walkable
// spots 8–35 m away in plain view, at least 4 m apart, facing the spawn.
function placeDummies(map, spawn, count) {
  const nav = buildNavGraph(map);
  const eye = [spawn.pos[0], spawn.pos[1] + EYE_HEIGHT, spawn.pos[2]];
  const spots = nav.nodes.filter(n => {
    const d = Math.hypot(n.x - spawn.pos[0], n.z - spawn.pos[2]);
    return n.component === nav.mainComponent && d >= 8 && d <= 35
      && !overlapsAny(bodyBox([n.x, n.y, n.z], { lift: 0.01 }), map.boxes)
      && lineOfSight(eye, [n.x, n.y + 1, n.z], map.boxes);
  });
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const chosen = [];
  for (const n of spots) {
    if (chosen.length >= count) break;
    if (chosen.every(c => Math.hypot(c.x - n.x, c.z - n.z) >= 4)) chosen.push(n);
  }
  return chosen.map((n, i) => ({
    id: `dummy-${i}`,
    team: "enemy",
    pos: [n.x, n.y, n.z],
    yaw: Math.atan2(n.x - spawn.pos[0], n.z - spawn.pos[2]),
    height: BODY_HEIGHT,
    health: createHealth(),
    deadFor: 0,
    hitFlash: 0,
  }));
}

export function createGame({ map, view, input, getSettings, isPaused, primary }) {
  const pickSpawn = () => map.playerSpawns[Math.floor(Math.random() * map.playerSpawns.length)];
  // The player is an actor too (id/team/health), so grenades can hurt them.
  const spawnPlayer = () => Object.assign(createPlayer(pickSpawn()), { id: "player", team: "player", health: createHealth() });

  let player = spawnPlayer();
  let loadout = createLoadout(primary);
  let respawnIn = 0;
  const dummies = placeDummies(map, map.playerSpawns[0], DUMMY_COUNT);
  const actors = () => [player, ...dummies];
  const grenades = [];
  const viewModel = createViewModel(view.vmScene);
  const fx = createEffects(view.scene);
  const dummyMeshes = createDummyMeshes(view.scene, dummies);
  let eye = eyeHeight(player);
  let zoom = 1; // current FOV multiplier (eases toward the weapon's ADS zoom)

  // HUD feedback, as counters so the React side can restart an animation
  // each time one changes.
  let hurtCount = 0;
  let marker = { n: 0, kind: "hit" };

  // Sniper scope overlay is up once the zoom has mostly settled in.
  const scoped = () => !!activeWeapon(loadout).scope && loadout.ads && zoom < 0.5;

  // Shots and throws start where the camera is: `eye` is the eased eye
  // height the camera uses, not the instant one, so crouching mid-fight
  // doesn't shift shots away from the crosshair.
  const eyePos = () => [player.pos[0], player.pos[1] + eye, player.pos[2]];

  // Applies damage to any actor; `byPlayer` drives the hit marker.
  function hurt(actor, amount, { byPlayer = false, part = "body" } = {}) {
    const { dealt, killed } = applyDamage(actor.health, amount);
    if (!dealt) return;
    if (actor === player) {
      hurtCount++;
      if (killed) {
        respawnIn = PLAYER_RESPAWN_DELAY;
        loadout.ads = false;
      }
    } else {
      actor.hitFlash = HIT_FLASH;
      if (killed) actor.deadFor = 0;
    }
    if (byPlayer && actor !== player) {
      marker = { n: marker.n + 1, kind: killed ? "kill" : part === "head" ? "head" : "hit" };
    }
  }

  function fireShot(e) {
    const w = WEAPONS[e.weapon];
    const origin = eyePos();
    for (const [ox, oy] of e.pellets) {
      const d = direction(player.yaw + ox, player.pitch + oy);
      const end = origin.map((v, i) => v + d[i] * w.range);
      const wall = raycastWorld(origin, end, map.boxes);
      const body = raycastActors(origin, end, actors(), player.id);
      if (body && (!wall || body.t < wall.t)) {
        hurt(body.actor, shotDamage(w, body.t * w.range, body.part), { byPlayer: true, part: body.part });
        fx.impact(origin.map((v, i) => v + d[i] * w.range * body.t), BLOOD);
      } else if (wall) {
        fx.bulletHole(wall.point, wall.normal);
        fx.impact(wall.point);
      }
    }
    const fwd = direction(player.yaw, player.pitch);
    fx.muzzle(origin.map((v, i) => v + fwd[i] * 0.8));
    viewModel.shot();
  }

  function melee(e) {
    const origin = eyePos();
    const d = direction(player.yaw, player.pitch);
    const end = origin.map((v, i) => v + d[i] * e.range);
    const wall = raycastWorld(origin, end, map.boxes);
    const body = raycastActors(origin, end, actors(), player.id);
    if (body && (!wall || body.t < wall.t)) {
      hurt(body.actor, meleeDamage(WEAPONS.knife, player.yaw, body.actor.yaw), { byPlayer: true, part: body.part });
      fx.impact(origin.map((v, i) => v + d[i] * e.range * body.t), BLOOD);
    } else if (wall) {
      fx.impact(wall.point);
    }
    viewModel.melee();
  }

  function throwGrenade() {
    const w = WEAPONS.grenade;
    const origin = eyePos();
    const d = direction(player.yaw, Math.min(player.pitch + THROW_LIFT, Math.PI / 2));
    const start = origin.map((v, i) => v + d[i] * 0.3);
    grenades.push(createGrenade(start, d, w.throwSpeed, w.fuse, player.vel));
    viewModel.thrown();
  }

  function explode(g) {
    const w = WEAPONS.grenade;
    fx.explosion(g.pos, w.radius);
    for (const { actor, amount } of explosionDamage(g.pos, w.radius, w.damage, actors(), map.boxes)) {
      hurt(actor, amount, { byPlayer: true });
    }
  }

  function respawn() {
    player = spawnPlayer();
    loadout = createLoadout(primary);
    eye = eyeHeight(player);
    zoom = 1;
  }

  return {
    update(dt) {
      if (isPaused()) return;

      if (player.health.dead) {
        // Drain input so nothing queued while dead fires after respawning.
        input.read();
        input.readWeapon();
        respawnIn -= dt;
        if (respawnIn <= 0) respawn();
      } else {
        const move = input.read();
        stepPlayer(player, { ...move, ads: loadout.ads }, dt, map.boxes);

        const ctx = { speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED, airborne: !player.onGround };
        const { events, kick } = stepWeapons(loadout, input.readWeapon(), dt, ctx);
        for (const e of events) {
          if (e.type === "shot") fireShot(e);
          else if (e.type === "melee") melee(e);
          else if (e.type === "throw") throwGrenade();
        }
        // Recoil moves the view only after this tick's shots have used the aim
        // the player saw — otherwise every bullet includes its own kick and
        // lands above the crosshair (very visible through the sniper scope).
        look(player, kick[0], -kick[1]);
        stepHealth(player.health, dt);
      }

      for (const d of dummies) {
        d.hitFlash = Math.max(0, d.hitFlash - dt);
        if (d.health.dead) {
          d.deadFor += dt;
          if (d.deadFor >= DUMMY_RESPAWN_DELAY) revive(d.health);
        } else {
          stepHealth(d.health, dt);
        }
      }

      for (let i = grenades.length - 1; i >= 0; i--) {
        if (stepGrenade(grenades[i], dt, map.boxes)) {
          explode(grenades[i]);
          grenades.splice(i, 1);
        }
      }
    },

    // Look is applied per frame, not per tick, so aiming is never quantised
    // to the simulation rate. Position is interpolated between the last two
    // ticks by `alpha` so movement stays smooth on high-refresh displays.
    render(alpha, frameDt) {
      const { camera } = view;
      const paused = isPaused();
      const dead = player.health.dead;
      const [dx, dy] = input.takeLook();
      const settings = getSettings();
      const w = activeWeapon(loadout);
      zoom += ((loadout.ads ? w.adsZoom : 1) - zoom) * Math.min(1, frameDt * 14);
      if (!paused && !dead) {
        // Slower mouse when zoomed in, so the scope isn't twitchy.
        const k = MOUSE_RADIANS_PER_PX * settings.sensitivity * zoom;
        const [kx, ky] = input.keyLook();
        const turn = settings.keyTurnSpeed * zoom * Math.min(frameDt, 0.1);
        const pitchSign = settings.invertY ? -1 : 1;
        look(player, dx * k + kx * turn, (dy * k + ky * turn) * pitchSign);
      }
      const fov = settings.fov * zoom;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      // Ease the eye height so crouching doesn't snap the view; when dead the
      // view sinks to the floor and tips over.
      eye += ((dead ? 0.3 : eyeHeight(player)) - eye) * Math.min(1, frameDt * (dead ? 5 : 14));

      const { prev, pos } = player;
      const t = paused || dead ? 1 : alpha;
      camera.position.set(
        prev[0] + (pos[0] - prev[0]) * t,
        prev[1] + (pos[1] - prev[1]) * t + eye,
        prev[2] + (pos[2] - prev[2]) * t,
      );
      camera.rotation.set(player.pitch, player.yaw, dead ? 0.5 : 0, "YXZ");

      const dtFx = paused ? 0 : frameDt;
      viewModel.update(dtFx, {
        weapon: w.id,
        ads: loadout.ads,
        scoped: scoped(),
        hidden: dead,
        reloadFrac: loadout.reloading > 0 ? 1 - loadout.reloading / w.reload : 1,
        drawFrac: loadout.switching > 0 ? 1 - loadout.switching / w.draw : 1,
        speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED,
        onGround: player.onGround,
      });
      dummyMeshes.update();
      fx.setGrenades(grenades, t);
      fx.update(dtFx);
    },

    // Values for the React HUD (compared as a string, so keep it small).
    hud() {
      const w = activeWeapon(loadout);
      const a = loadout.ammo[w.id];
      return {
        hp: Math.ceil(player.health.hp),
        dead: player.health.dead,
        respawnIn: Math.max(0, Math.ceil(respawnIn)),
        hurt: hurtCount,
        marker,
        weapon: w.name,
        kind: w.kind,
        mag: a?.mag ?? null,
        reserve: w.kind === "gun" ? a.reserve : null,
        reloading: loadout.reloading > 0,
        ads: loadout.ads,
        scoped: scoped(),
        slots: loadout.slots.map((id, i) => ({
          key: i + 1,
          name: WEAPONS[id].name,
          active: i === loadout.active,
          empty: id === "grenade" && loadout.ammo.grenade.mag === 0,
          count: id === "grenade" ? loadout.ammo.grenade.mag : null,
        })),
      };
    },

    dispose() {
      viewModel.dispose();
      fx.dispose();
      dummyMeshes.dispose();
    },
  };
}
