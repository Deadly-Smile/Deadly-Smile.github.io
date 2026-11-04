// ─── Single-player session ──────────────────────────────────────────────────
// Glue between the pure engine and the browser: feeds input into the
// simulation each tick and places the camera each frame. Grows with every
// ticket (weapons, enemies, waves…); for now it's a player walking a map.
import { createPlayer, stepPlayer, look, eyeHeight } from "./engine/player.js";

// Radians of turn per pixel of mouse movement at sensitivity 1.
const MOUSE_RADIANS_PER_PX = 0.0022;

export function createGame({ map, input, getSettings, isPaused }) {
  const spawn = map.playerSpawns[Math.floor(Math.random() * map.playerSpawns.length)];
  const player = createPlayer(spawn);
  let eye = eyeHeight(player);

  return {
    player,
    update(dt) {
      if (isPaused()) return;
      stepPlayer(player, input.read(), dt, map.boxes);
    },
    // Look is applied per frame, not per tick, so aiming is never quantised
    // to the simulation rate. Position is interpolated between the last two
    // ticks by `alpha` so movement stays smooth on high-refresh displays.
    placeCamera(camera, alpha, frameDt) {
      const paused = isPaused();
      const [dx, dy] = input.takeLook();
      const settings = getSettings();
      if (!paused) {
        const k = MOUSE_RADIANS_PER_PX * settings.sensitivity;
        look(player, dx * k, (settings.invertY ? -dy : dy) * k);
      }
      if (camera.fov !== settings.fov) {
        camera.fov = settings.fov;
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
    },
  };
}
