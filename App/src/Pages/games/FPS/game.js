// ─── Single-player session: survival waves ──────────────────────────────────
// Glue between the pure engine and the browser: feeds input into the
// simulation each tick, runs the wave director and the bots, turns weapon
// events into rays/projectiles/damage/effects, handles drops and pickups,
// and places the camera each frame. Death ends the run (`onGameOver`).
import { createPlayer, stepPlayer, look, eyeHeight, WALK_SPEED } from "./engine/player.js";
import { createLoadout, stepWeapons, activeWeapon, currentSpread, WEAPONS } from "./engine/weapons.js";
import { relativeAngle } from "./engine/hud.js";
import { createGrenade, stepGrenade } from "./engine/projectile.js";
import { raycastWorld, EYE_HEIGHT } from "./engine/geometry.js";
import {
  createHealth, applyDamage, stepHealth, raycastActors,
  shotDamage, meleeDamage, explosionDamage,
} from "./engine/damage.js";
import { buildNavGraph } from "./engine/nav.js";
import { createBot, thinkBot, hear, notifyDamage, eyeOf, HEARING_RANGE, BOT_HEADSHOT_CAP } from "./engine/ai.js";
import { createWaves, stepWaves, waveKill, pickSpawnPoint, scoreOf } from "./engine/waves.js";
import { rollDrops, stepDrops, nearDrop, takeDrop, swapPrimary } from "./engine/pickups.js";
import { createViewModel } from "./render/viewModel.js";
import { createEffects } from "./render/effects.js";
import { createActorMeshes } from "./render/actors.js";
import { createCharacters } from "./render/characters.js";
import { createPickupMeshes } from "./render/pickups.js";
import { qualityOf } from "./engine/quality.js";

// Radians of turn per pixel of mouse movement at sensitivity 1.
const MOUSE_RADIANS_PER_PX = 0.0022;
// Grenades leave the hand a little above the aim line.
const THROW_LIFT = 0.18;
const GAME_OVER_DELAY = 2;     // s of death camera before the results
const CORPSE_TIME = 3;         // s a dead bot stays before it's removed
const HIT_FLASH = 0.15;
const MUZZLE_FLASH = 0.06;
const MESSAGE_TIME = 1.5;
const FEED_TIME = 5;           // s a kill stays in the feed
const FEED_MAX = 4;
const DAMAGE_DIR_TIME = 1.2;   // s a damage-direction arc stays up
// Footsteps: one per stride (m) on the ground; bots are heard within range.
const STRIDE = { walk: 1.7, sprint: 2.3, crouch: 1.2 };
const BOT_STEP_RANGE = 25;
// Silent stand-in when there's no audio (see audio.js for the real thing).
const NO_AUDIO = new Proxy({}, { get: () => () => {} });
// Death camera: pulls out to look at the player's body from behind and above.
const DEATH_CAM_DISTANCE = 3.2;
const DEATH_CAM_HEIGHT = 1.9;
const BLOOD = 0xb91c1c;

// Unit vector for a view direction (yaw 0 = -z, pitch up positive).
function direction(yaw, pitch) {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

// `models` is the loaded character/weapon set (render/models.js), or null to
// use the box figures and guns. `audio` is the session's sound player
// (audio.js), or null for silence.
export function createGame({ map, view, input, getSettings, isPaused, primary, difficulty = "normal", onGameOver, models = null, audio = null }) {
  const sfx = audio ?? NO_AUDIO;
  const nav = buildNavGraph(map);
  const start = map.playerSpawns[Math.floor(Math.random() * map.playerSpawns.length)];
  // The player is an actor too (id/team/health), so bots and grenades can hurt them.
  const player = Object.assign(createPlayer(start), { id: "player", team: "player", health: createHealth() });
  const loadout = createLoadout(primary);
  const waves = createWaves(difficulty);
  let bots = [];
  let botSerial = 0;
  let drops = [];
  const grenades = [];
  const botWorld = { boxes: map.boxes, nav, actors: [] };
  const actors = () => [player, ...bots];

  const viewModel = createViewModel(view.vmScene, models);
  const fx = createEffects(view.scene, models);
  const weaponOf = (a) => activeWeapon(a === player ? loadout : a.loadout).id;
  // Low graphics keeps the cheap box figures (chosen per run).
  const figures = models && qualityOf(getSettings().quality).models
    ? createCharacters(view.scene, models, { modelFor: a => (a.team === "enemy" ? "enemy" : "soldier"), weaponOf })
    : createActorMeshes(view.scene);
  const pickupMeshes = createPickupMeshes(view.scene, models);
  let deathCam = 0; // 0 → 1 as the camera pulls out to the body
  let eye = eyeHeight(player);
  let zoom = 1; // current FOV multiplier (eases toward the weapon's ADS zoom)
  let overIn = null; // s until the results screen, once dead

  // Run stats and HUD feedback (counters let React restart an animation).
  const stats = { kills: 0, headshots: 0 };
  let hurtCount = 0;
  let marker = { n: 0, kind: "hit" };
  let feed = [];        // { id, killer, victim, weapon, headshot, left }
  let damageFrom = [];  // { id, from: [x,y,z], left }
  let hudSerial = 0;
  const nameOf = (a) => (a === player ? "You" : "SWAT");
  let message = { n: 0, text: "", left: 0 };
  let banner = { n: 0, text: "" };

  // Sniper scope overlay is up once the zoom has mostly settled in.
  const scoped = () => !!activeWeapon(loadout).scope && loadout.ads && zoom < 0.5;

  // Shots and throws start where the camera is: `eye` is the eased eye
  // height the camera uses, not the instant one, so crouching mid-fight
  // doesn't shift shots away from the crosshair.
  const eyePos = () => [player.pos[0], player.pos[1] + eye, player.pos[2]];

  // Pickup messages (and their sound).
  const say = (text) => {
    message = { n: message.n + 1, text, left: MESSAGE_TIME };
    sfx.pickup();
  };

  // One footstep per stride while on the ground and moving.
  function footsteps(actor, dt, play) {
    const speed = Math.hypot(actor.vel[0], actor.vel[2]);
    if (!actor.onGround || speed < 1) return;
    actor.stepDist = (actor.stepDist ?? 0) + speed * dt;
    const stride = actor.crouched ? STRIDE.crouch : speed > 5.6 ? STRIDE.sprint : STRIDE.walk;
    if (actor.stepDist >= stride) {
      actor.stepDist = 0;
      play();
    }
  }

  // Every living bot within `range` of a noise at `pos` hears it.
  function noise(pos, range) {
    for (const b of bots) {
      if (Math.hypot(b.pos[0] - pos[0], b.pos[2] - pos[2]) <= range) hear(b, pos);
    }
  }

  function spawnBot(config) {
    const at = pickSpawnPoint(map.enemySpawns, player.pos, EYE_HEIGHT, map.boxes);
    if (!at) return;
    const primaries = config.skill.primaries;
    const bot = Object.assign(createBot({
      id: `bot-${botSerial++}`, team: "enemy", spawn: at,
      primary: primaries[Math.floor(Math.random() * primaries.length)],
      skill: config.skill, maxHp: config.hp,
    }), { hitFlash: 0, flash: 0 });
    // Survival: new arrivals come looking for the player straight away.
    hear(bot, player.pos);
    bots.push(bot);
  }

  // Applies damage to any actor. `attacker` drives the hit marker (when it's
  // the player) and tells a bot where it was shot from; `weapon` names it in
  // the kill feed; `from` is where the damage came from (defaults to the
  // attacker), for the player's damage-direction indicator.
  function hurt(actor, amount, { attacker = null, part = "body", weapon = null, from = null } = {}) {
    const { dealt, killed } = applyDamage(actor.health, amount);
    if (!dealt) return;
    actor.hitAgo = 0;
    if (killed && attacker) {
      feed = [...feed, { id: ++hudSerial, killer: nameOf(attacker), victim: nameOf(actor), weapon, headshot: part === "head", left: FEED_TIME }].slice(-FEED_MAX);
    }
    if (actor === player) {
      hurtCount++;
      sfx.hurt();
      const source = from ?? attacker?.pos;
      if (source && attacker !== player) damageFrom = [...damageFrom, { id: ++hudSerial, from: [...source], left: DAMAGE_DIR_TIME }];
      if (killed) {
        overIn = GAME_OVER_DELAY;
        sfx.death();
        loadout.ads = false;
        player.deadFor = 0;
      }
      return;
    }
    actor.hitFlash = HIT_FLASH;
    if (killed) {
      actor.deadFor = 0;
      waveKill(waves);
      drops.push(...rollDrops(actor.pos, actor.loadout.slots[0]));
    } else if (attacker) {
      notifyDamage(actor, attacker.pos);
    }
    if (attacker === player) {
      if (killed) {
        stats.kills++;
        if (part === "head") stats.headshots++;
      }
      marker = { n: marker.n + 1, kind: killed ? "kill" : part === "head" ? "head" : "hit" };
      sfx.hit(marker.kind);
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
        hurt(body.actor, shotDamage(w, body.t * w.range, body.part, maxHeadshot) * scale, { attacker: shooter, part: body.part, weapon: e.weapon });
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
      hurt(body.actor, meleeDamage(WEAPONS.knife, player.yaw, body.actor.yaw), { attacker: player, part: body.part, weapon: "knife" });
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
    sfx.explosion(g.pos);
    noise(g.pos, HEARING_RANGE.explosion);
    for (const { actor, amount } of explosionDamage(g.pos, w.radius, w.damage, actors(), map.boxes)) {
      hurt(actor, amount, { attacker: player, weapon: "grenade", from: g.pos });
    }
  }

  // Walk-over pickups are automatic; a gun is taken with E. Returns the gun
  // drop in reach (for the HUD prompt), if any.
  function pickups(use) {
    let gunInReach = null;
    for (const d of drops) {
      if (!nearDrop(d, player.pos)) continue;
      if (d.kind === "gun") {
        gunInReach ??= d;
        continue;
      }
      const got = takeDrop(loadout, d);
      if (got) {
        say(got);
        d.ttl = 0;
      }
    }
    if (use && gunInReach) {
      const left = swapPrimary(loadout, gunInReach, player.pos);
      gunInReach.ttl = 0;
      if (left) drops.push(left);
      say(left ? `Picked up ${WEAPONS[gunInReach.weapon].name}` : `+${gunInReach.mag + gunInReach.reserve} ammo`);
      gunInReach = null;
    }
    drops = drops.filter(d => d.ttl > 0);
    return gunInReach;
  }
  let gunPrompt = null;

  function stepBots(dt) {
    botWorld.actors = actors();
    for (const bot of bots) {
      bot.hitFlash = Math.max(0, bot.hitFlash - dt);
      bot.flash = Math.max(0, bot.flash - dt);
      bot.firedAgo = (bot.firedAgo ?? Infinity) + dt;
      bot.hitAgo = (bot.hitAgo ?? Infinity) + dt;
      if (bot.health.dead) {
        bot.deadFor += dt;
        bot.prev = [...bot.pos];
        continue;
      }
      const { move, weapon } = thinkBot(bot, botWorld, dt);
      stepPlayer(bot, move, dt, map.boxes);
      if (Math.hypot(bot.pos[0] - player.pos[0], bot.pos[2] - player.pos[2]) < BOT_STEP_RANGE) {
        footsteps(bot, dt, () => sfx.step(bot.pos, bot.crouched));
      }
      const ctx = { speedFrac: Math.hypot(bot.vel[0], bot.vel[2]) / WALK_SPEED, airborne: !bot.onGround };
      const { events } = stepWeapons(bot.loadout, weapon, dt, ctx);
      for (const e of events) {
        if (e.type !== "shot") continue;
        shoot(bot, e, eyeOf(bot), { scale: bot.skill.damage, maxHeadshot: BOT_HEADSHOT_CAP });
        sfx.shot(e.weapon, eyeOf(bot));
        bot.flash = MUZZLE_FLASH;
        bot.firedAgo = 0;
      }
      stepHealth(bot.health, dt);
    }
    bots = bots.filter(b => !(b.health.dead && b.deadFor > CORPSE_TIME));
  }

  function stepWaveDirector(dt) {
    const alive = bots.filter(b => !b.health.dead).length;
    const spawnReady = !!pickSpawnPoint(map.enemySpawns, player.pos, EYE_HEIGHT, map.boxes);
    for (const e of stepWaves(waves, { alive, spawnReady }, dt)) {
      if (e.type === "wave") {
        banner = { n: banner.n + 1, text: `Wave ${e.wave}` };
        sfx.waveStart();
      }
      else if (e.type === "spawn") spawnBot(e.config);
      else if (e.type === "cleared") {
        banner = { n: banner.n + 1, text: `Wave ${e.wave} cleared` };
        sfx.waveCleared();
      }
    }
  }

  // Third-person view of the player's body, eased in from first person and
  // slowly circling; pulled in where a wall would be in the way.
  function placeDeathCamera(frameDt) {
    const { camera } = view;
    deathCam = Math.min(1, deathCam + frameDt * 1.2);
    const k = deathCam * deathCam * (3 - 2 * deathCam);
    const target = [player.pos[0], player.pos[1] + 0.8, player.pos[2]];
    const yaw = player.yaw + player.deadFor * 0.35;
    const want = [
      target[0] + Math.sin(yaw) * DEATH_CAM_DISTANCE,
      player.pos[1] + DEATH_CAM_HEIGHT,
      target[2] + Math.cos(yaw) * DEATH_CAM_DISTANCE,
    ];
    const wall = raycastWorld(target, want, map.boxes);
    const reach = wall ? Math.max(0, wall.t - 0.1) : 1;
    const out = target.map((v, i) => v + (want[i] - v) * reach);
    camera.position.set(
      camera.position.x + (out[0] - camera.position.x) * k,
      camera.position.y + (out[1] - camera.position.y) * k,
      camera.position.z + (out[2] - camera.position.z) * k,
    );
    camera.lookAt(target[0], target[1], target[2]);
  }

  const runStats = () => ({
    wave: waves.wave,
    waves: waves.cleared,
    kills: stats.kills,
    headshots: stats.headshots,
    score: scoreOf({ ...stats, waves: waves.cleared }),
  });

  return {
    update(dt) {
      if (isPaused()) return;

      if (player.health.dead) {
        // Drain input so nothing queued is left over.
        input.read();
        input.readWeapon();
        player.deadFor += dt;
        if (overIn !== null) {
          overIn -= dt;
          if (overIn <= 0) {
            overIn = null;
            onGameOver?.(runStats());
          }
        }
      } else {
        const move = input.read();
        stepPlayer(player, { ...move, ads: loadout.ads }, dt, map.boxes);
        footsteps(player, dt, () => sfx.step(null, player.crouched));

        const ctx = { speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED, airborne: !player.onGround };
        const { events, kick } = stepWeapons(loadout, input.readWeapon(), dt, ctx);
        for (const e of events) {
          if (e.type === "shot") {
            shoot(player, e, eyePos());
            viewModel.shot();
            sfx.shot(e.weapon);
            noise(player.pos, HEARING_RANGE.shot);
          } else if (e.type === "melee") {
            melee(e);
            sfx.swish();
          } else if (e.type === "throw") {
            throwGrenade();
            sfx.swish();
          } else if (e.type === "reload") sfx.reload(e.duration);
          else if (e.type === "empty") sfx.empty();
          else if (e.type === "switch") sfx.draw();
        }
        // Recoil moves the view only after this tick's shots have used the aim
        // the player saw — otherwise every bullet includes its own kick and
        // lands above the crosshair (very visible through the sniper scope).
        look(player, kick[0], -kick[1]);
        stepHealth(player.health, dt);
        gunPrompt = pickups(move.use);
        stepWaveDirector(dt);
      }

      stepBots(dt);
      drops = stepDrops(drops, dt);
      message.left = Math.max(0, message.left - dt);
      if (feed.length) feed = feed.filter(f => (f.left -= dt) > 0);
      if (damageFrom.length) damageFrom = damageFrom.filter(d => (d.left -= dt) > 0);

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
      camera.rotation.set(player.pitch, player.yaw, dead && !models ? 0.5 : 0, "YXZ");
      sfx.setListener(player.pos, player.yaw);
      if (dead && models) placeDeathCamera(frameDt);

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
      // The player's own body is only drawn once dead (for the death camera).
      figures.update(dead && models ? [...bots, player] : bots, paused ? 1 : alpha, dtFx);
      pickupMeshes.update(drops, dtFx);
      fx.setGrenades(grenades, t);
      fx.setFlashLights(qualityOf(settings.quality).flashLights);
      fx.update(dtFx);
    },

    // The crosshair, read every frame (not through the HUD's 10 Hz poll):
    // the current cone of fire and the field of view it's seen through.
    crosshair() {
      const ctx = { speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED, airborne: !player.onGround };
      return { spread: currentSpread(loadout, ctx), fov: view.camera.fov };
    },

    // Values for the React HUD (compared as a string, so keep it small).
    hud() {
      const w = activeWeapon(loadout);
      const a = loadout.ammo[w.id];
      const run = runStats();
      return {
        hp: Math.ceil(player.health.hp),
        dead: player.health.dead,
        hurt: hurtCount,
        marker,
        feed: feed.map(({ id, killer, victim, weapon, headshot }) => ({
          id, killer, victim, headshot, weapon: weapon ? WEAPONS[weapon].name : "",
        })),
        // Rounded to 5° so the HUD only re-renders when an arc visibly moves.
        damage: damageFrom.map(({ id, from }) => ({
          id, angle: Math.round((relativeAngle(player.pos, player.yaw, from) * 180) / Math.PI / 5) * 5,
        })),
        score: run.score,
        kills: run.kills,
        wave: waves.wave,
        // Between waves: whole seconds to the next one; during: bots left.
        breakLeft: waves.phase === "break" ? Math.ceil(waves.breakLeft) : null,
        enemiesLeft: waves.phase === "active" ? waves.config.count - waves.killed : null,
        banner,
        message: message.left > 0 ? { n: message.n, text: message.text } : null,
        prompt: gunPrompt ? `E — take ${WEAPONS[gunPrompt.weapon].name}` : null,
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
      figures.dispose();
      pickupMeshes.dispose();
    },
  };
}
