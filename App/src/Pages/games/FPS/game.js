// ─── Single-player session ──────────────────────────────────────────────────
// Glue between the pure engine and the browser: feeds input into the
// simulation each tick, turns weapon events into rays/projectiles/effects,
// and places the camera each frame. Grows with every ticket (enemies,
// waves…); for now it's a player with a full loadout on an empty map.
import { createPlayer, stepPlayer, look, eyeHeight, WALK_SPEED } from "./engine/player.js";
import { createLoadout, stepWeapons, activeWeapon, WEAPONS } from "./engine/weapons.js";
import { createGrenade, stepGrenade } from "./engine/projectile.js";
import { raycastWorld } from "./engine/geometry.js";
import { createViewModel } from "./render/viewModel.js";
import { createEffects } from "./render/effects.js";

// Radians of turn per pixel of mouse movement at sensitivity 1.
const MOUSE_RADIANS_PER_PX = 0.0022;
// Grenades leave the hand a little above the aim line.
const THROW_LIFT = 0.18;

// Unit vector for a view direction (yaw 0 = -z, pitch up positive).
function direction(yaw, pitch) {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

export function createGame({ map, view, input, getSettings, isPaused, primary }) {
  const spawn = map.playerSpawns[Math.floor(Math.random() * map.playerSpawns.length)];
  const player = createPlayer(spawn);
  const loadout = createLoadout(primary);
  const grenades = [];
  const viewModel = createViewModel(view.vmScene);
  const fx = createEffects(view.scene);
  let eye = eyeHeight(player);
  let zoom = 1; // current FOV multiplier (eases toward the weapon's ADS zoom)

  // Sniper scope overlay is up once the zoom has mostly settled in.
  const scoped = () => !!activeWeapon(loadout).scope && loadout.ads && zoom < 0.5;

  // Shots and throws start where the camera is: `eye` is the eased eye
  // height the camera uses, not the instant one, so crouching mid-fight
  // doesn't shift shots away from the crosshair.
  const eyePos = () => [player.pos[0], player.pos[1] + eye, player.pos[2]];

  function fireShot(e) {
    const w = WEAPONS[e.weapon];
    const origin = eyePos();
    for (const [ox, oy] of e.pellets) {
      const d = direction(player.yaw + ox, player.pitch + oy);
      const end = origin.map((v, i) => v + d[i] * w.range);
      const hit = raycastWorld(origin, end, map.boxes);
      if (hit) {
        fx.bulletHole(hit.point, hit.normal);
        fx.impact(hit.point);
      }
    }
    const fwd = direction(player.yaw, player.pitch);
    fx.muzzle(origin.map((v, i) => v + fwd[i] * 0.8));
    viewModel.shot();
  }

  function melee(e) {
    const origin = eyePos();
    const d = direction(player.yaw, player.pitch);
    const hit = raycastWorld(origin, origin.map((v, i) => v + d[i] * e.range), map.boxes);
    if (hit) fx.impact(hit.point);
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

  return {
    update(dt) {
      if (isPaused()) return;
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

      for (let i = grenades.length - 1; i >= 0; i--) {
        if (stepGrenade(grenades[i], dt, map.boxes)) {
          fx.explosion(grenades[i].pos, WEAPONS.grenade.radius);
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
      const [dx, dy] = input.takeLook();
      const settings = getSettings();
      const w = activeWeapon(loadout);
      zoom += ((loadout.ads ? w.adsZoom : 1) - zoom) * Math.min(1, frameDt * 14);
      if (!paused) {
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

      // Ease the eye height so crouching doesn't snap the view.
      eye += (eyeHeight(player) - eye) * Math.min(1, frameDt * 14);

      const { prev, pos } = player;
      const t = paused ? 1 : alpha;
      camera.position.set(
        prev[0] + (pos[0] - prev[0]) * t,
        prev[1] + (pos[1] - prev[1]) * t + eye,
        prev[2] + (pos[2] - prev[2]) * t,
      );
      camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");

      const dtFx = paused ? 0 : frameDt;
      viewModel.update(dtFx, {
        weapon: w.id,
        ads: loadout.ads,
        scoped: scoped(),
        reloadFrac: loadout.reloading > 0 ? 1 - loadout.reloading / w.reload : 1,
        drawFrac: loadout.switching > 0 ? 1 - loadout.switching / w.draw : 1,
        speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED,
        onGround: player.onGround,
      });
      fx.setGrenades(grenades, t);
      fx.update(dtFx);
    },

    // Values for the React HUD (compared as a string, so keep it small).
    hud() {
      const w = activeWeapon(loadout);
      const a = loadout.ammo[w.id];
      return {
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
    },
  };
}
