// ─── Multiplayer match in the browser ───────────────────────────────────────
// The multiplayer counterpart of game.js: feeds local input into a network
// session (net/session.js) each tick, and draws the local view, the other
// players, grenades, drops and effects each frame. The match never pauses —
// losing the pointer lock only stops the local player's input.
//
// What the local player does is shown at once (predicted on a guest); what
// it *achieves* — hits, damage, kills, pickups — only ever comes back from
// the host, through session.drain(). The bullet holes and tracers drawn
// here are for show.
import { look, eyeHeight, WALK_SPEED } from "./engine/player.js";
import { activeWeapon, currentSpread, WEAPONS } from "./engine/weapons.js";
import { raycastWorld } from "./engine/geometry.js";
import { raycastActors } from "./engine/damage.js";
import { nearDrop } from "./engine/pickups.js";
import { relativeAngle } from "./engine/hud.js";
import { qualityOf } from "./engine/quality.js";
import { direction } from "./net/command.js";
import { createViewModel } from "./render/viewModel.js";
import { createEffects } from "./render/effects.js";
import { createActorMeshes } from "./render/actors.js";
import { createCharacters } from "./render/characters.js";
import { createPickupMeshes } from "./render/pickups.js";

// Radians of turn per pixel of mouse movement at sensitivity 1.
const MOUSE_RADIANS_PER_PX = 0.0022;
const NO_INPUT = { forward: false, back: false, left: false, right: false, jump: false, sprint: false, crouch: false, ads: false };
const NO_WEAPON = { fire: false, ads: false, reload: false, slot: null, scroll: 0, lastWeapon: false };
// A prediction correction is eased in at this rate (1/s); a jump bigger than
// SNAP metres is a respawn and isn't eased at all.
const CORRECTION_RATE = 12;
const SNAP = 3;
const MESSAGE_TIME = 1.5;
const FEED_TIME = 5;
const FEED_MAX = 4;
const DAMAGE_DIR_TIME = 1.2;
const MUZZLE_FLASH = 0.06;
const STRIDE = { walk: 1.7, sprint: 2.3, crouch: 1.2 };
const BLOOD = 0xb91c1c;
const CHAT_KEEP = 30;    // lines kept
const CHAT_SHOW = 8;     // lines the HUD shows
const CHAT_FRESH = 8;    // s a line stays on screen (all show while typing)
// Silent stand-in when there's no audio (see audio.js for the real thing).
const NO_AUDIO = new Proxy({}, { get: () => () => {} });

// `chatLog`: an array owned by the caller, so chat survives this object
// being rebuilt (it is, when the map changes); one per session.
export function createNetGame({ map, view, input, getSettings, isPaused, models = null, audio = null, session, chatLog = [] }) {
  const sfx = audio ?? NO_AUDIO;
  const player = session.body;
  const { loadout } = session;
  const useModels = models && qualityOf(getSettings().quality).models;
  const viewModel = createViewModel(view.vmScene, models);
  const fx = createEffects(view.scene, models);
  // Teammates wear the Soldier, the other team the SWAT gear (box figures:
  // blue for team A, orange for team B).
  const teamOf = (id) => session.roster.find(p => p.id === id)?.team ?? "a";
  const figures = useModels
    ? createCharacters(view.scene, models, { modelFor: a => (a.team === teamOf(session.selfId) ? "soldier" : "enemy"), weaponOf: a => a.weapon })
    : createActorMeshes(view.scene);
  const pickupMeshes = createPickupMeshes(view.scene, models);
  const actors = new Map(); // player id → the object its figure is drawn from
  let drawn = [];           // …as a list, for this frame
  let drops = [];
  let eye = eyeHeight(player);
  let zoom = 1;
  let stepDist = 0;
  const offset = [0, 0, 0]; // where the view still lags behind a correction

  // HUD feedback (counters let React restart an animation).
  let hurtCount = 0;
  let marker = { n: 0, kind: "hit" };
  let message = { n: 0, text: "", left: 0 };
  let feed = [];
  let damageFrom = [];
  let serial = 0;
  const nameOf = (id) => (id === session.selfId ? "You" : session.roster.find(p => p.id === id)?.name ?? "Player");

  const scoped = () => !!activeWeapon(loadout).scope && loadout.ads && zoom < 0.5;
  const eyePos = (a = player, h = eye) => [a.pos[0], a.pos[1] + h, a.pos[2]];

  // A ray for show: bullet hole or blood puff where it lands; returns the end.
  function cosmeticRay(origin, d, range, selfId) {
    const end = origin.map((v, i) => v + d[i] * range);
    const wall = raycastWorld(origin, end, map.boxes);
    const body = raycastActors(origin, end, drawn, selfId);
    if (body && (!wall || body.t < wall.t)) {
      const at = origin.map((v, i) => v + d[i] * range * body.t);
      fx.impact(at, BLOOD);
      return at;
    }
    if (wall) {
      fx.bulletHole(wall.point, wall.normal);
      fx.impact(wall.point);
      return wall.point;
    }
    return end;
  }

  function localEvents({ events, kick }) {
    for (const e of events) {
      if (e.type === "shot") {
        const origin = eyePos();
        for (const [ox, oy] of e.pellets) cosmeticRay(origin, direction(player.yaw + ox, player.pitch + oy), WEAPONS[e.weapon].range, null);
        const fwd = direction(player.yaw, player.pitch);
        fx.muzzle(origin.map((v, i) => v + fwd[i] * 0.8));
        viewModel.shot();
        sfx.shot(e.weapon);
      } else if (e.type === "melee") {
        viewModel.melee();
        sfx.swish();
      } else if (e.type === "throw") {
        viewModel.thrown();
        sfx.swish();
      } else if (e.type === "reload") sfx.reload(e.duration);
      else if (e.type === "empty") sfx.empty();
      else if (e.type === "switch") sfx.draw();
    }
    look(player, kick[0], -kick[1]);
  }

  // What the host says happened.
  function gameEvents() {
    for (const m of session.drain()) {
      if (m.t === "hit") {
        marker = { n: marker.n + 1, kind: m.kind };
        sfx.hit(m.kind);
      } else if (m.t === "hurt") {
        hurtCount++;
        sfx.hurt();
        if (!m.self) damageFrom = [...damageFrom, { id: ++serial, from: m.from, left: DAMAGE_DIR_TIME }];
      } else if (m.t === "kill") {
        feed = [...feed, {
          id: ++serial, killer: nameOf(m.killer), victim: nameOf(m.victim),
          weapon: WEAPONS[m.weapon]?.name ?? "", headshot: !!m.headshot, left: FEED_TIME,
        }].slice(-FEED_MAX);
        if (m.victim === session.selfId) sfx.death();
      } else if (m.t === "boom") {
        fx.explosion(m.pos, WEAPONS.grenade.radius);
        sfx.explosion(m.pos);
      } else if (m.t === "pickup") {
        message = { n: message.n + 1, text: m.text, left: MESSAGE_TIME };
        sfx.pickup();
      } else if (m.t === "drops") {
        drops = m.list.map(d => ({ ...d, ttl: 99 }));
      } else if (m.t === "chat" && typeof m.text === "string") {
        chatLog.push({
          id: (chatLog.at(-1)?.id ?? 0) + 1, at: performance.now(), system: !!m.system, text: m.text,
          from: m.from, name: String(m.name ?? ""), team: m.team, scope: m.scope === "team" ? "team" : "all",
        });
        if (chatLog.length > CHAT_KEEP) chatLog.splice(0, chatLog.length - CHAT_KEEP);
      }
    }
  }

  function actorFor(o, dt) {
    // Keyed by team too: changing sides gets a fresh figure in the new kit.
    const team = teamOf(o.id);
    const key = `${o.id}:${team}`;
    let a = actors.get(key);
    if (!a) actors.set(key, a = { id: key, team, health: { dead: false }, deadFor: 0, hitFlash: 0, flash: 0, firedAgo: Infinity, shots: o.shots });
    if (o.dead && !a.health.dead) a.deadFor = 0;
    a.health.dead = !!o.dead;
    a.deadFor += dt;
    a.flash = Math.max(0, a.flash - dt);
    a.firedAgo += dt;
    Object.assign(a, { pos: o.pos, prev: o.prev, vel: o.vel, yaw: o.yaw, pitch: o.pitch, onGround: o.onGround, crouched: o.crouched, height: o.height, weapon: o.weapon });
    // The shot counter moved: this player fired since we last looked.
    if (o.shots !== a.shots) {
      a.shots = o.shots;
      if (!a.health.dead) {
        a.firedAgo = 0;
        a.flash = MUZZLE_FLASH;
        const origin = [o.pos[0], o.pos[1] + o.height - 0.2, o.pos[2]];
        const d = direction(o.yaw, o.pitch);
        const end = cosmeticRay(origin, d, WEAPONS[o.weapon]?.range ?? 60, key);
        fx.tracer([origin[0] + d[0] * 0.6, origin[1] - 0.25, origin[2] + d[2] * 0.6], end);
        sfx.shot(o.weapon, origin);
      }
    }
    return a;
  }

  return {
    update(dt) {
      // Always read (so nothing queues up while paused), only use when playing.
      const move = input.read();
      const weapon = input.readWeapon();
      // No input while the menu is open or between matches.
      const idle = isPaused() || session.match.state === "over";
      const out = session.step({
        input: idle ? NO_INPUT : { ...move, ads: weapon.ads },
        weapon: idle ? NO_WEAPON : weapon,
        use: !idle && !!move.use,
        yaw: player.yaw,
        pitch: player.pitch,
      });
      localEvents(out);
      gameEvents();

      const speed = Math.hypot(player.vel[0], player.vel[2]);
      if (player.onGround && speed > 1 && !session.self().dead) {
        stepDist += speed * dt;
        if (stepDist >= (player.crouched ? STRIDE.crouch : speed > 5.6 ? STRIDE.sprint : STRIDE.walk)) {
          stepDist = 0;
          sfx.step(null, player.crouched);
        }
      }
      message.left = Math.max(0, message.left - dt);
      if (feed.length) feed = feed.filter(f => (f.left -= dt) > 0);
      if (damageFrom.length) damageFrom = damageFrom.filter(d => (d.left -= dt) > 0);
    },

    render(alpha, frameDt) {
      const { camera } = view;
      const paused = isPaused();
      const settings = getSettings();
      const { dead } = session.self();
      const w = activeWeapon(loadout);
      const [dx, dy] = input.takeLook();
      zoom += ((loadout.ads && !dead ? w.adsZoom : 1) - zoom) * Math.min(1, frameDt * 14);
      if (!paused && !dead) {
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

      // Keep the view where it was when prediction is corrected, then ease
      // it over to the corrected position.
      const moved = session.takeCorrection();
      if (Math.hypot(...moved) > SNAP) offset.fill(0);
      else for (let i = 0; i < 3; i++) offset[i] -= moved[i];
      const keep = Math.exp(-frameDt * CORRECTION_RATE);
      for (let i = 0; i < 3; i++) offset[i] *= keep;

      // When dead the view sinks to the floor and tips over.
      eye += ((dead ? 0.3 : eyeHeight(player)) - eye) * Math.min(1, frameDt * (dead ? 5 : 14));
      const { prev, pos } = player;
      const t = dead ? 1 : alpha;
      camera.position.set(
        prev[0] + (pos[0] - prev[0]) * t + offset[0],
        prev[1] + (pos[1] - prev[1]) * t + eye + offset[1],
        prev[2] + (pos[2] - prev[2]) * t + offset[2],
      );
      camera.rotation.set(player.pitch, player.yaw, dead ? 0.5 : 0, "YXZ");
      sfx.setListener(player.pos, player.yaw);

      viewModel.update(frameDt, {
        weapon: w.id,
        ads: loadout.ads,
        scoped: scoped(),
        hidden: dead,
        reloadFrac: loadout.reloading > 0 ? 1 - loadout.reloading / w.reload : 1,
        drawFrac: loadout.switching > 0 ? 1 - loadout.switching / w.draw : 1,
        speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED,
        onGround: player.onGround,
      });

      // Everyone else. The host's are real bodies (interpolate between its
      // ticks); a guest's are already interpolated snapshots.
      const seen = new Set();
      drawn = session.others(performance.now()).map((o) => {
        const a = actorFor(o, frameDt);
        seen.add(a.id);
        return a;
      });
      for (const id of actors.keys()) if (!seen.has(id)) actors.delete(id);
      figures.update(drawn, session.role === "host" ? alpha : 1, frameDt);

      pickupMeshes.update(drops, frameDt);
      fx.setGrenades(session.grenades().map(g => ({ pos: g, prev: g })), 1);
      fx.setFlashLights(qualityOf(settings.quality).flashLights);
      fx.update(frameDt);
    },

    crosshair() {
      const ctx = { speedFrac: Math.hypot(player.vel[0], player.vel[2]) / WALK_SPEED, airborne: !player.onGround };
      return { spread: currentSpread(loadout, ctx), fov: view.camera.fov };
    },

    // Values for the React HUD (compared as a string, so keep it small).
    // The same shape as game.js's, plus `net`.
    hud() {
      const w = activeWeapon(loadout);
      const a = loadout.ammo[w.id];
      const me = session.self();
      const { ping, stalled } = session.status();
      const gun = me.dead ? null : drops.find(d => d.kind === "gun" && nearDrop(d, player.pos));
      return {
        hp: Math.ceil(me.hp),
        dead: me.dead,
        respawnIn: Math.ceil(me.respawnIn),
        hurt: hurtCount,
        marker,
        feed: feed.map(({ id, killer, victim, weapon, headshot }) => ({ id, killer, victim, weapon, headshot })),
        damage: damageFrom.map(({ id, from }) => ({
          id, angle: Math.round((relativeAngle(player.pos, player.yaw, from) * 180) / Math.PI / 5) * 5,
        })),
        banner: { n: 0, text: "" },
        chat: chatLog.slice(-CHAT_SHOW).map(c => ({
          id: c.id, system: c.system, text: c.text, name: c.name, team: c.team, scope: c.scope,
          self: c.from === session.selfId, fresh: performance.now() - c.at < CHAT_FRESH * 1000,
        })),
        message: message.left > 0 ? { n: message.n, text: message.text } : null,
        prompt: gun ? `E — take ${WEAPONS[gun.weapon].name}` : null,
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
        net: {
          role: session.role, roomId: session.roomId, players: session.roster, selfId: session.selfId, ping, stalled,
          team: teamOf(session.selfId), match: session.match, showScores: input.scoreboard(),
        },
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
