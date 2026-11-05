// ─── Survival waves ─────────────────────────────────────────────────────────
// Single-player mode: waves of bots, each bigger and tougher than the last,
// with a short break in between. Death ends the run.
//
// stepWaves() is the wave director: given how many bots are alive and
// whether a spawn point is free, it says when a wave starts, when to spawn
// the next bot and when a wave is cleared. Which spawn point to use is
// pickSpawnPoint()'s job: only hidden ones, out of the player's sight and
// not too close. Pure; mutates the wave state in place.
import { lineOfSight } from "./geometry.js";
import { DIFFICULTY } from "./ai.js";

export const FIRST_BREAK = 5;        // s before wave 1
export const WAVE_BREAK = 8;         // s between waves
export const SPAWN_INTERVAL = 1.2;   // s between two spawns in a wave
export const SAFE_SPAWN_DIST = 15;   // m from the player, at least

// How wave `n` (1-based) looks for a base difficulty: more bots, more of
// them at once, and bots that get tougher — more health, quicker, steadier,
// harder-hitting — up to a ceiling.
export function waveConfig(n, difficulty = "normal") {
  const base = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  const k = n - 1;
  const primaries = n >= 5 && !base.primaries.includes("sniper") ? [...base.primaries, "sniper"] : base.primaries;
  return {
    wave: n,
    count: 3 + 2 * k,
    maxAlive: Math.min(3 + Math.floor(k / 2), 7),
    hp: Math.round(100 * Math.min(2, 1 + 0.1 * k)),
    skill: {
      ...base,
      reaction: base.reaction * Math.max(0.6, 1 - 0.04 * k),
      aimError: base.aimError * Math.max(0.6, 1 - 0.04 * k),
      wobble: base.wobble * Math.max(0.6, 1 - 0.04 * k),
      damage: base.damage * Math.min(1.5, 1 + 0.05 * k),
      primaries,
    },
  };
}

export function createWaves(difficulty = "normal") {
  return {
    difficulty,
    wave: 0,
    phase: "break",          // "break" (counting down to the next wave) | "active"
    breakLeft: FIRST_BREAK,
    config: null,
    spawned: 0,
    killed: 0,
    spawnCooldown: 0,
    cleared: 0,              // waves fully cleared
  };
}

// One tick. ctx: { alive (bots alive now), spawnReady (a spawn point is
// free) }. Returns events: { type: "wave", wave, config } when a wave
// starts, { type: "spawn", config } when a bot should spawn now,
// { type: "cleared", wave } when the last bot of a wave dies.
export function stepWaves(w, ctx, dt) {
  const events = [];
  if (w.phase === "break") {
    w.breakLeft -= dt;
    if (w.breakLeft <= 0) {
      w.wave++;
      w.phase = "active";
      w.config = waveConfig(w.wave, w.difficulty);
      w.spawned = 0;
      w.killed = 0;
      w.spawnCooldown = 0;
      events.push({ type: "wave", wave: w.wave, config: w.config });
    }
    return events;
  }

  w.spawnCooldown -= dt;
  const { count, maxAlive } = w.config;
  if (w.spawned < count && ctx.alive < maxAlive && w.spawnCooldown <= 0 && ctx.spawnReady) {
    w.spawned++;
    w.spawnCooldown = SPAWN_INTERVAL;
    events.push({ type: "spawn", config: w.config });
  }
  if (w.spawned >= count && ctx.alive === 0 && w.killed >= count) {
    w.cleared++;
    w.phase = "break";
    w.breakLeft = WAVE_BREAK;
    events.push({ type: "cleared", wave: w.wave });
  }
  return events;
}

// A bot of the current wave died.
export function waveKill(w) {
  if (w.phase === "active") w.killed++;
}

// Hidden spawn points the player can't see from where they stand and that
// are at least SAFE_SPAWN_DIST away; one at random, or null (wait).
export function pickSpawnPoint(spawns, playerPos, playerEyeHeight, boxes, rand = Math.random) {
  const eye = [playerPos[0], playerPos[1] + playerEyeHeight, playerPos[2]];
  const ok = spawns.filter(s =>
    Math.hypot(s.pos[0] - playerPos[0], s.pos[2] - playerPos[2]) >= SAFE_SPAWN_DIST
    && !lineOfSight(eye, [s.pos[0], s.pos[1] + 1.0, s.pos[2]], boxes)
    && !lineOfSight(eye, [s.pos[0], s.pos[1] + 1.7, s.pos[2]], boxes));
  return ok.length ? ok[Math.floor(rand() * ok.length)] : null;
}

// Score for a run: kills, a bonus per headshot kill, a bigger one per wave.
export const SCORE = { kill: 100, headshot: 50, wave: 500 };
export const scoreOf = ({ kills, headshots, waves }) => kills * SCORE.kill + headshots * SCORE.headshot + waves * SCORE.wave;
