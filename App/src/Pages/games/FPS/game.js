// ─── Single-player session ──────────────────────────────────────────────────
// Glue between the pure engine and the browser: feeds input into the
// simulation each tick, runs the bots, turns weapon events into rays/
// projectiles/damage/effects, and places the camera each frame. Grows with
// every ticket; for now it's the player against a fixed squad of bots that
// respawn at hidden spawns (FPS-7 turns this into waves).
import { createPlayer, stepPlayer, look, eyeHeight, WALK_SPEED } from "./engine/player.js";
import { createLoadout, stepWeapons, activeWeapon, WEAPONS } from "./engine/weapons.js";
import { createGrenade, stepGrenade } from "./engine/projectile.js";
import { raycastWorld, lineOfSight, EYE_HEIGHT } from "./engine/geometry.js";
import {
  createHealth, applyDamage, stepHealth, raycastActors,
  shotDamage, meleeDamage, explosionDamage,
} from "./engine/damage.js";
import { buildNavGraph } from "./engine/nav.js";
import {
  createBot, resetBot, thinkBot, hear, notifyDamage, eyeOf, canSee, DIFFICULTY, HEARING_RANGE, BOT_HEADSHOT_CAP,
} from "./engine/ai.js";
import { createViewModel } from "./render/viewModel.js";
import { createEffects } from "./render/effects.js";
import { createActorMeshes } from "./render/actors.js";

// Radians of turn per pixel of mouse movement at sensitivity 1.
const MOUSE_RADIANS_PER_PX = 0.0022;
// Grenades leave the hand a little above the aim line.
const THROW_LIFT = 0.18;
const PLAYER_RESPAWN_DELAY = 3;
// After (re)spawning the player can't be hurt for this long, so bots that
// chased them back to the start can't kill them again on arrival.
const SPAWN_PROTECTION = 2;
const BOT_COUNT = 4;
const BOT_RESPAWN_DELAY = 6;
// A bot never respawns closer than this to the player, nor in their sight.
const SAFE_SPAWN_DIST = 15;
const HIT_FLASH = 0.15;
const MUZZLE_FLASH = 0.06;
const BLOOD = 0xb91c1c;

// Unit vector for a view direction (yaw 0 = -z, pitch up positive).
function direction(yaw, pitch) {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

export function createGame({ map, view, input, getSettings, isPaused, primary, difficulty = "normal" }) {
  const nav = buildNavGraph(map);
  let bots = [];

  // Safest player start: one no living bot can see, then the one farthest
  // from the nearest bot. Random among equals (e.g. at the very start).
  // Respawns may also use both teams' spawns, so there's always somewhere
  // away from bots that chased the player back to the start.
  const respawnSpots = [...map.playerSpawns, ...map.teamSpawns.a, ...map.teamSpawns.b];
  function pickSpawn() {
    const living = bots.filter(b => !b.health.dead);
    if (!living.length) return map.playerSpawns[Math.floor(Math.random() * map.playerSpawns.length)];
    const score = (s) => {
      const probe = { pos: s.pos, height: 1.8 };
      const seen = living.some(b => canSee(b, probe, map.boxes, { range: 80, anyDirection: true }));
      const nearest = Math.min(Infinity, ...living.map(b => Math.hypot(b.pos[0] - s.pos[0], b.pos[2] - s.pos[2])));
      return (seen ? 0 : 1000) + Math.min(nearest, 999) + Math.random();
    };
    const scored = respawnSpots.map(s => [score(s), s]);
    return scored.reduce((best, cur) => (cur[0] > best[0] ? cur : best))[1];
  }
  // The player is an actor too (id/team/health), so bots and grenades can hurt them.
  const spawnPlayer = () => Object.assign(createPlayer(pickSpawn()), {
    id: "player", team: "player", health: createHealth(), protectedFor: SPAWN_PROTECTION,
  });

  let player = spawnPlayer();
  let loadout = createLoadout(primary);
  let respawnIn = 0;

  // Hidden enemy spawn out of the player's sight and not too close; any
  // enemy spawn if none qualifies.
  function botSpawn() {
    const eye = [player.pos[0], player.pos[1] + EYE_HEIGHT, player.pos[2]];
    const ok = map.enemySpawns.filter(s =>
      Math.hypot(s.pos[0] - player.pos[0], s.pos[2] - player.pos[2]) >= SAFE_SPAWN_DIST
      && !lineOfSight(eye, [s.pos[0], s.pos[1] + 1.6, s.pos[2]], map.boxes));
    const list = ok.length ? ok : map.enemySpawns;
    return list[Math.floor(Math.random() * list.length)];
  }
  const botPrimaries = (DIFFICULTY[difficulty] ?? DIFFICULTY.normal).primaries;
  const randomPrimary = () => botPrimaries[Math.floor(Math.random() * botPrimaries.length)];
  bots = Array.from({ length: BOT_COUNT }, (_, i) => Object.assign(
    createBot({ id: `bot-${i}`, team: "enemy", spawn: map.enemySpawns[i % map.enemySpawns.length], primary: randomPrimary(), difficulty }),
    { hitFlash: 0, flash: 0 },
  ));
  const actors = () => [player, ...bots];
  const botWorld = { boxes: map.boxes, nav, actors: [] };
  const damageScale = DIFFICULTY[difficulty]?.damage ?? 1;

  const grenades = [];
  const viewModel = createViewModel(view.vmScene);
  const fx = createEffects(view.scene);
  const botMeshes = createActorMeshes(view.scene, bots);
  let eye = eyeHeight(player);
  let zoom = 1; // current FOV multiplier (eases toward the weapon's ADS zoom)

  // HUD feedback, as counters so the React side can restart an animation
  // each time one changes.
  let hurtCount = 0;
  let marker = { n: 0, kind: "hit" };
  let kills = 0;

  // Sniper scope overlay is up once the zoom has mostly settled in.
  const scoped = () => !!activeWeapon(loadout).scope && loadout.ads && zoom < 0.5;

  // Shots and throws start where the camera is: `eye` is the eased eye
  // height the camera uses, not the instant one, so crouching mid-fight
  // doesn't shift shots away from the crosshair.
  const eyePos = () => [player.pos[0], player.pos[1] + eye, player.pos[2]];

  // Every bot within `range` of a noise at `pos` hears it.
  function noise(pos, range) {
    for (const b of bots) {
      if (Math.hypot(b.pos[0] - pos[0], b.pos[2] - pos[2]) <= range) hear(b, pos);
    }
  }

  // Applies damage to any actor. `attacker` drives the hit marker (when it's
  // the player) and tells a bot where it was shot from.
  function hurt(actor, amount, { attacker = null, part = "body" } = {}) {
    if (actor === player && player.protectedFor > 0) return;
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
      else if (attacker) notifyDamage(actor, attacker.pos);
    }
    if (attacker === player && actor !== player) {
      if (killed) kills++;
      marker = { n: marker.n + 1, kind: killed ? "kill" : part === "head" ? "head" : "hit" };
    }
  }

  // One shot's pellets from `shooter` (player or bot) along its view. Rays
  // stop at the nearest wall or body; teammates are passed through.
  function shoot(shooter, e, origin, { scale = 1, maxHeadshot = Infinity } = {}) {
    const w = WEAPONS[e.weapon];
    const targets = actors().filter(a => a === shooter || a.team !== shooter.team);
    for (const [ox, oy] of e.pellets) {
      const d = direction(shooter.yaw + ox, shooter.pitch + oy);
      const end = origin.map((v, i) => v + d[i] * w.range);
      const wall = raycastWorld(origin, end, map.boxes);
      const body = raycastActors(origin, end, targets, shooter.id);
      let hitPoint = end;
      if (body && (!wall || body.t < wall.t)) {
        hitPoint = origin.map((v, i) => v + d[i] * w.range * body.t);
        hurt(body.actor, shotDamage(w, body.t * w.range, body.part, maxHeadshot) * scale, { attacker: shooter, part: body.part });
        fx.impact(hitPoint, BLOOD);
      } else if (wall) {
        hitPoint = wall.point;
        fx.bulletHole(wall.point, wall.normal);
        fx.impact(wall.point);
      }
      if (shooter !== player) {
        // Start the tracer at the bot's gun, not its eye.
        const muzzle = [origin[0] + d[0] * 0.6, origin[1] - 0.25, origin[2] + d[2] * 0.6];
        fx.tracer(muzzle, hitPoint);
      }
    }
    const fwd = direction(shooter.yaw, shooter.pitch);
    fx.muzzle(origin.map((v, i) => v + fwd[i] * 0.8));
  }

  function melee(e) {
    const origin = eyePos();
    const d = direction(player.yaw, player.pitch);
    const end = origin.map((v, i) => v + d[i] * e.range);
    const wall = raycastWorld(origin, end, map.boxes);
    const body = raycastActors(origin, end, actors(), player.id);
    if (body && (!wall || body.t < wall.t)) {
      hurt(body.actor, meleeDamage(WEAPONS.knife, player.yaw, body.actor.yaw), { attacker: player, part: body.part });
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
    noise(g.pos, HEARING_RANGE.explosion);
    for (const { actor, amount } of explosionDamage(g.pos, w.radius, w.damage, actors(), map.boxes)) {
      hurt(actor, amount, { attacker: player });
    }
  }

  function respawnPlayer() {
    player = spawnPlayer();
    loadout = createLoadout(primary);
    eye = eyeHeight(player);
    zoom = 1;
  }

  function stepBots(dt) {
    botWorld.actors = actors();
    for (const bot of bots) {
      bot.hitFlash = Math.max(0, bot.hitFlash - dt);
      bot.flash = Math.max(0, bot.flash - dt);
      if (bot.health.dead) {
        bot.deadFor += dt;
        bot.prev = [...bot.pos];
        if (bot.deadFor >= BOT_RESPAWN_DELAY) resetBot(bot, botSpawn(), randomPrimary());
        continue;
      }
      const { move, weapon } = thinkBot(bot, botWorld, dt);
      stepPlayer(bot, move, dt, map.boxes);
      const ctx = { speedFrac: Math.hypot(bot.vel[0], bot.vel[2]) / WALK_SPEED, airborne: !bot.onGround };
      const { events } = stepWeapons(bot.loadout, weapon, dt, ctx);
      for (const e of events) {
        if (e.type !== "shot") continue;
        shoot(bot, e, eyeOf(bot), { scale: damageScale, maxHeadshot: BOT_HEADSHOT_CAP });
        bot.flash = MUZZLE_FLASH;
      }
      stepHealth(bot.health, dt);
    }
  }

  return {
    update(dt) {
      if (isPaused()) return;

      if (player.health.dead) {
        // Drain input so nothing queued while dead fires after respawning.
        input.read();
        input.readWeapon();
        respawnIn -= dt;
        if (respawnIn <= 0) respawnPlayer();
      } else {
        const move = input.read();
        stepPlayer(player, { ...move, ads: loadout.ads }, dt, map.boxes);

        const ctx = { speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED, airborne: !player.onGround };
        const { events, kick } = stepWeapons(loadout, input.readWeapon(), dt, ctx);
        for (const e of events) {
          if (e.type === "shot") {
            shoot(player, e, eyePos());
            viewModel.shot();
            noise(player.pos, HEARING_RANGE.shot);
          } else if (e.type === "melee") melee(e);
          else if (e.type === "throw") throwGrenade();
        }
        // Recoil moves the view only after this tick's shots have used the aim
        // the player saw — otherwise every bullet includes its own kick and
        // lands above the crosshair (very visible through the sniper scope).
        look(player, kick[0], -kick[1]);
        stepHealth(player.health, dt);
        player.protectedFor = Math.max(0, player.protectedFor - dt);
      }

      stepBots(dt);

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
      botMeshes.update(paused ? 1 : alpha, dtFx);
      fx.setGrenades(grenades, t);
      fx.update(dtFx);
    },

    // Values for the React HUD (compared as a string, so keep it small).
    hud() {
      const w = activeWeapon(loadout);
      const a = loadout.ammo[w.id];
      return {
        hp: Math.ceil(player.health.hp),
        protected: player.protectedFor > 0,
        dead: player.health.dead,
        respawnIn: Math.max(0, Math.ceil(respawnIn)),
        hurt: hurtCount,
        marker,
        kills,
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
      botMeshes.dispose();
    },
  };
}
