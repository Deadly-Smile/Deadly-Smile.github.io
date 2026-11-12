// ─── Multiplayer session in the browser ─────────────────────────────────────
// The multiplayer counterpart of game.js: feeds local input into a network
// session (net/session.js) each tick and draws the local view and the other
// players each frame. The simulation never pauses — losing the pointer lock
// only stops the local player's input.
//
// For now players can walk the map together and see each other; weapons,
// damage and scoring over the network arrive with FPS-10 and FPS-11.
import { look, eyeHeight } from "./engine/player.js";
import { qualityOf } from "./engine/quality.js";
import { createActorMeshes } from "./render/actors.js";
import { createCharacters } from "./render/characters.js";

// Radians of turn per pixel of mouse movement at sensitivity 1.
const MOUSE_RADIANS_PER_PX = 0.0022;
const NO_INPUT = { forward: false, back: false, left: false, right: false, jump: false, sprint: false, crouch: false, ads: false };
// A prediction correction is eased in at this rate (1/s); a jump bigger than
// SNAP metres is a respawn/teleport and isn't eased at all.
const CORRECTION_RATE = 12;
const SNAP = 3;

export function createNetGame({ map, view, input, getSettings, isPaused, models = null, session }) {
  session.setBoxes?.(map.boxes);
  const player = session.body;
  const figures = models && qualityOf(getSettings().quality).models
    ? createCharacters(view.scene, models, { modelFor: () => "soldier", weaponOf: () => "rifle" })
    : createActorMeshes(view.scene);
  const actors = new Map(); // player id → the object the figures are drawn from
  let eye = eyeHeight(player);
  const offset = [0, 0, 0]; // where the view still lags behind a correction

  function actorFor(o) {
    let a = actors.get(o.id);
    if (!a) actors.set(o.id, a = { id: `p${o.id}`, team: "a", health: { dead: false }, deadFor: 0, hitFlash: 0, flash: 0 });
    a.pos = o.pos;
    a.prev = o.prev;
    a.vel = o.vel;
    a.yaw = o.yaw;
    a.pitch = o.pitch;
    a.onGround = o.onGround;
    a.crouched = o.crouched;
    a.height = o.height;
    return a;
  }

  return {
    update() {
      // Always read (so nothing queues up while paused), only use when playing.
      const move = input.read();
      input.readWeapon();
      session.step(isPaused() ? NO_INPUT : { ...move, ads: false }, player.yaw, player.pitch);
    },

    render(alpha, frameDt) {
      const { camera } = view;
      const paused = isPaused();
      const settings = getSettings();
      const [dx, dy] = input.takeLook();
      if (!paused) {
        const k = MOUSE_RADIANS_PER_PX * settings.sensitivity;
        const [kx, ky] = input.keyLook();
        const turn = settings.keyTurnSpeed * Math.min(frameDt, 0.1);
        const pitchSign = settings.invertY ? -1 : 1;
        look(player, dx * k + kx * turn, (dy * k + ky * turn) * pitchSign);
      }
      if (Math.abs(camera.fov - settings.fov) > 0.01) {
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
      }

      // Keep the view where it was when prediction is corrected, then ease
      // it over to the corrected position.
      const moved = session.takeCorrection();
      if (Math.hypot(...moved) > SNAP) offset.fill(0);
      else for (let i = 0; i < 3; i++) offset[i] -= moved[i];
      const keep = Math.exp(-frameDt * CORRECTION_RATE);
      for (let i = 0; i < 3; i++) offset[i] *= keep;

      eye += (eyeHeight(player) - eye) * Math.min(1, frameDt * 14);
      const { prev, pos } = player;
      camera.position.set(
        prev[0] + (pos[0] - prev[0]) * alpha + offset[0],
        prev[1] + (pos[1] - prev[1]) * alpha + eye + offset[1],
        prev[2] + (pos[2] - prev[2]) * alpha + offset[2],
      );
      camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");

      // Everyone else. The host's are real bodies (interpolate between its
      // ticks); a guest's are already interpolated snapshots.
      const others = session.others(performance.now());
      const seen = new Set();
      const list = others.map((o) => {
        seen.add(o.id);
        return actorFor(o);
      });
      for (const id of actors.keys()) if (!seen.has(id)) actors.delete(id);
      figures.update(list, session.role === "host" ? alpha : 1, frameDt);
    },

    // Values for the React HUD (compared as a string, so keep it small).
    hud() {
      const { ping, stalled } = session.status();
      return { net: { role: session.role, roomId: session.roomId, players: session.roster, selfId: session.selfId, ping, stalled } };
    },

    dispose() {
      figures.dispose();
    },
  };
}
