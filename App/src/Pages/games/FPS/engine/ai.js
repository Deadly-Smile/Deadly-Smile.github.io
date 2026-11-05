// ─── Bots ───────────────────────────────────────────────────────────────────
// A bot is a player body (same physics) plus a loadout (same weapons) plus a
// brain. Each tick thinkBot() looks at the world and returns the input a
// human would have pressed: movement keys and a trigger. It also turns the
// bot's view (yaw/pitch), at a limited speed, toward whatever it's doing.
//
// States:
//   patrol  wander between random walkable spots, pausing now and then
//   alert   heard a shot / got hit: turn and walk toward the noise
//   attack  an enemy is in sight: aim (with settling error), fire in bursts,
//           keep a weapon-appropriate distance, strafe, duck into cover to
//           reload
//   chase   lost sight of the enemy: run to where it was last seen
//   search  look around there for a while, then go back to patrol
//
// Targets are "any living actor on another team", so the same brain works
// for single-player (bots vs. player) and Team Deathmatch (bots on both
// sides). Pure: no three.js/DOM; `rand` is injectable for tests.
import { createPlayer, eyeHeight } from "./player.js";
import { createLoadout, activeWeapon } from "./weapons.js";
import { createHealth } from "./damage.js";
import { lineOfSight } from "./geometry.js";
import { nearestNode } from "./nav.js";
import { findPath, smoothPath } from "./path.js";

// reaction: s from first sight to first shot. aimError: initial aim offset
// (rad) that decays at aimSettle (1/s). wobble: aim sway (rad) that never
// settles, so long shots miss more than close ones. turnSpeed: rad/s.
// damage: multiplier on the bot's weapon damage. burst/pause: s ranges for
// trigger bursts. primaries: what bots carry (snipers only on hard).
export const DIFFICULTY = {
  easy: {
    reaction: 0.9, aimError: 0.12, aimSettle: 1.5, wobble: 0.045, turnSpeed: 3, damage: 0.45,
    burst: [0.15, 0.35], pause: [0.7, 1.3], viewRange: 35, primaries: ["rifle", "rifle", "smg", "smg", "shotgun"],
  },
  normal: {
    reaction: 0.55, aimError: 0.08, aimSettle: 2.5, wobble: 0.025, turnSpeed: 4.5, damage: 0.7,
    burst: [0.25, 0.5], pause: [0.45, 0.9], viewRange: 45, primaries: ["rifle", "rifle", "smg", "smg", "shotgun"],
  },
  hard: {
    reaction: 0.3, aimError: 0.05, aimSettle: 4, wobble: 0.012, turnSpeed: 6.5, damage: 1,
    burst: [0.3, 0.7], pause: [0.25, 0.6], viewRange: 60, primaries: ["rifle", "rifle", "smg", "smg", "shotgun", "sniper"],
  },
};
// Bots' headshots hurt at most this much more than body shots, so an unseen
// bot can't one-shot the player from across the map (except a hard sniper).
export const BOT_HEADSHOT_CAP = 1.5;
export const DIFFICULTIES = ["easy", "normal", "hard"];

export const VIEW_HALF_ANGLE = Math.PI / 3;  // 120° view cone
export const HEARING_RANGE = { shot: 40, explosion: 50 };
// Distances (m) each weapon likes to fight at.
const PREFERRED_RANGE = { smg: [6, 18], rifle: [10, 30], shotgun: [2.5, 8], sniper: [18, 60], pistol: [6, 18], knife: [0, 1.5] };
const LOST_SIGHT_GRACE = 0.4;  // s of not seeing the target before chasing
const REACQUIRE_TIME = 2;      // s within which a re-sighting keeps the reaction progress
const SEARCH_TIME = 5;
const ALERT_TIMEOUT = 10;
const CHASE_TIMEOUT = 12;
const REPATH_INTERVAL = 0.8;
const ARRIVE_DIST = 0.6;
const STUCK_TIME = 1.2;
const FIRE_ANGLE = 0.09;       // only shoot when aim is within this of the target
const COVER_SEARCH_RADIUS = 8;

const pick = (rand, [a, b]) => a + (b - a) * rand();
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const flatDist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// View angles from a point to another (yaw 0 = facing -z).
export const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
export const pitchTo = (from, to) => Math.atan2(to[1] - from[1], flatDist(from, to));
export const eyeOf = (a) => [a.pos[0], a.pos[1] + eyeHeight(a), a.pos[2]];

function freshBrain() {
  return {
    state: "patrol", stateTime: 0,
    target: null, lastSeen: null, lastSeenAgo: Infinity,
    heard: null,
    reactionLeft: 0, aimError: [0, 0],
    burstLeft: 0, pauseLeft: 0, semiToggle: false,
    strafe: 1, strafeLeft: 0,
    path: null, pathIdx: 0, goal: null, repathIn: 0,
    idleLeft: 0, stuckFor: 0, lastProgress: null,
    cover: null,
    // Per-bot phase of the aim sway, so a squad doesn't wobble in step.
    wobblePhase: Math.random() * 100,
  };
}

export function createBot({ id, team, spawn, primary = "rifle", difficulty = "normal" }) {
  const bot = Object.assign(createPlayer(spawn), { id, team, difficulty });
  resetBot(bot, spawn, primary);
  return bot;
}

// Respawn in place (same object, so whatever renders it keeps working).
export function resetBot(bot, spawn, primary = bot.loadout?.slots[0] ?? "rifle") {
  Object.assign(bot, createPlayer(spawn), {
    health: createHealth(),
    loadout: createLoadout(primary),
    brain: freshBrain(),
    deadFor: 0,
  });
}

// Can `bot` see `target`? Within view range, inside the view cone (unless
// `anyDirection`), and an unobstructed line from its eye to their head or chest.
export function canSee(bot, target, boxes, { range, anyDirection = false }) {
  const eye = eyeOf(bot);
  const tp = target.pos;
  if (Math.hypot(tp[0] - eye[0], tp[1] - bot.pos[1], tp[2] - eye[2]) > range) return false;
  if (!anyDirection && Math.abs(angleDiff(yawTo(eye, tp), bot.yaw)) > VIEW_HALF_ANGLE) return false;
  return [target.height - 0.15, target.height * 0.6]
    .some(h => lineOfSight(eye, [tp[0], tp[1] + h, tp[2]], boxes));
}

// Nearest living actor on another team that the bot can see, or null.
export function pickTarget(bot, actors, boxes, opts) {
  let best = null;
  let bestD = Infinity;
  for (const a of actors) {
    if (a === bot || a.team === bot.team || a.health.dead) continue;
    const d = flatDist(a.pos, bot.pos);
    if (d < bestD && canSee(bot, a, boxes, opts)) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

function setState(b, state) {
  if (b.state === state) return;
  b.state = state;
  b.stateTime = 0;
  b.path = null;
  b.goal = null;
  b.cover = null;
}

// Something went bang nearby (a shot or an explosion at `pos`). Only bots
// not already fighting react: they turn and go have a look.
export function hear(bot, pos) {
  const b = bot.brain;
  if (bot.health.dead || b.state === "attack" || b.state === "chase") return;
  setState(b, "alert");
  b.heard = [...pos];
}

// The bot took damage from someone at `attackerPos`: it knows where they are
// even without seeing them.
export function notifyDamage(bot, attackerPos) {
  const b = bot.brain;
  if (bot.health.dead || b.state === "attack") return;
  b.lastSeen = [...attackerPos];
  b.lastSeenAgo = 0;
  setState(b, "chase");
}

// ─── Movement helpers ───────────────────────────────────────────────────────

function routeTo(bot, world, goal) {
  const b = bot.brain;
  const from = nearestNode(world.nav, bot.pos);
  if (from < 0) return false;
  const to = nearestNode(world.nav, goal, 4, world.nav.nodes[from].component);
  const raw = findPath(world.nav, from, to);
  b.path = raw ? smoothPath(world.nav, raw, world.boxes) : null;
  b.pathIdx = b.path && b.path.length > 1 ? 1 : 0;
  b.goal = [...goal];
  b.repathIn = REPATH_INTERVAL;
  b.stuckFor = 0;
  b.lastProgress = [...bot.pos];
  return !!b.path;
}

// Direction (unit [x, z]) to walk this tick along the current path, null when
// there's nothing left to walk. Sets `jump` on the brain when stuck.
function followPath(bot, world, dt) {
  const b = bot.brain;
  if (!b.path) return null;
  const N = world.nav.nodes;
  while (b.pathIdx < b.path.length) {
    const n = N[b.path[b.pathIdx]];
    if (Math.hypot(n.x - bot.pos[0], n.z - bot.pos[2]) > ARRIVE_DIST) break;
    b.pathIdx++;
  }
  if (b.pathIdx >= b.path.length) {
    b.path = null;
    return null;
  }
  // Stuck (walking into something the nav grid didn't foresee)? Hop and repath.
  b.stuckFor += dt;
  if (flatDist(bot.pos, b.lastProgress) > 0.5) {
    b.stuckFor = 0;
    b.lastProgress = [...bot.pos];
  } else if (b.stuckFor > STUCK_TIME) {
    b.jump = true;
    if (b.goal) routeTo(bot, world, b.goal);
    if (!b.path) return null;
  }
  const n = N[b.path[b.pathIdx]];
  const dx = n.x - bot.pos[0];
  const dz = n.z - bot.pos[2];
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}

// Key presses that move a body facing `yaw` along world direction [x, z].
export function keysFor(yaw, dir) {
  const keys = { forward: false, back: false, left: false, right: false };
  if (!dir) return keys;
  const f = -dir[0] * Math.sin(yaw) - dir[1] * Math.cos(yaw);
  const s = dir[0] * Math.cos(yaw) - dir[1] * Math.sin(yaw);
  keys.forward = f > 0.38;
  keys.back = f < -0.38;
  keys.right = s > 0.38;
  keys.left = s < -0.38;
  return keys;
}

function turnToward(bot, yaw, pitch, rate, dt) {
  const dy = angleDiff(yaw, bot.yaw);
  const step = rate * dt;
  bot.yaw += Math.max(-step, Math.min(step, dy));
  bot.pitch += Math.max(-step, Math.min(step, pitch - bot.pitch));
}

function randomGoal(bot, world, rand, [minD, maxD]) {
  const { nodes, mainComponent } = world.nav;
  for (let i = 0; i < 30; i++) {
    const n = nodes[Math.floor(rand() * nodes.length)];
    const d = Math.hypot(n.x - bot.pos[0], n.z - bot.pos[2]);
    if (n.component === mainComponent && d >= minD && d <= maxD) return [n.x, n.y, n.z];
  }
  return null;
}

// Nearest cover node within reach from which the threat can't see a crouched
// body (head at ~1.1 m).
function findCover(bot, world, threat) {
  const threatEye = eyeOf(threat);
  let best = null;
  let bestD = Infinity;
  for (const n of world.nav.nodes) {
    if (!n.cover || n.component !== world.nav.mainComponent) continue;
    const d = Math.hypot(n.x - bot.pos[0], n.z - bot.pos[2]);
    if (d > COVER_SEARCH_RADIUS || d >= bestD) continue;
    if (lineOfSight(threatEye, [n.x, n.y + 1.1, n.z], world.boxes)) continue;
    best = [n.x, n.y, n.z];
    bestD = d;
  }
  return best;
}

// ─── The brain ──────────────────────────────────────────────────────────────

// world: { boxes, nav, actors }. Returns { move, weapon } inputs for this
// tick (for stepPlayer / stepWeapons) and turns the bot's view.
export function thinkBot(bot, world, dt, rand = Math.random) {
  const b = bot.brain;
  const d = DIFFICULTY[bot.difficulty] ?? DIFFICULTY.normal;
  const w = activeWeapon(bot.loadout);
  const ammo = bot.loadout.ammo[w.id];
  // Bots never run dry: their reserve tops itself up (they still reload).
  if (ammo && ammo.reserve < w.mag) ammo.reserve += w.mag * 3;

  b.stateTime += dt;
  b.jump = false;
  let moveDir = null;
  let sprint = false;
  let crouch = false;
  let fire = false;
  let lookYaw = bot.yaw;
  let lookPitch = 0;

  // Perception: fighting bots track all around them, others only see ahead.
  const fighting = b.state === "attack" || b.state === "chase";
  const target = pickTarget(bot, world.actors, world.boxes, { range: d.viewRange, anyDirection: fighting && b.lastSeenAgo < 2 });
  if (target) {
    if (b.state !== "attack") {
      // Re-spotting the same enemy moments after losing it (it's peeking
      // round a corner) keeps the reaction already spent; a new sighting
      // starts it over.
      const reacquired = b.target === target.id && b.lastSeenAgo < REACQUIRE_TIME;
      setState(b, "attack");
      if (!reacquired) {
        b.reactionLeft = d.reaction * (0.8 + 0.4 * rand());
        b.aimError = [(rand() * 2 - 1) * d.aimError, (rand() * 2 - 1) * d.aimError * 0.5];
      }
      b.burstLeft = 0;
      b.pauseLeft = 0;
    }
    b.target = target.id;
    b.lastSeen = [...target.pos];
    b.lastSeenAgo = 0;
  } else {
    b.lastSeenAgo += dt;
  }

  switch (b.state) {
    case "patrol": {
      if (b.idleLeft > 0) {
        b.idleLeft -= dt;
        lookYaw = bot.yaw + Math.sin(b.stateTime * 0.8) * dt; // idle glance around
        break;
      }
      if (!b.path) {
        const goal = randomGoal(bot, world, rand, [8, 30]);
        if (goal) routeTo(bot, world, goal);
      }
      moveDir = followPath(bot, world, dt);
      if (!moveDir && !b.path) b.idleLeft = 1 + rand() * 2;
      if (moveDir) lookYaw = Math.atan2(-moveDir[0], -moveDir[1]);
      break;
    }

    case "alert": {
      if (!b.path && b.heard && b.stateTime < dt * 1.5) routeTo(bot, world, b.heard);
      moveDir = followPath(bot, world, dt);
      lookYaw = moveDir ? Math.atan2(-moveDir[0], -moveDir[1]) : yawTo(bot.pos, b.heard ?? bot.pos);
      if ((!moveDir && b.stateTime > 0.5) || b.stateTime > ALERT_TIMEOUT) setState(b, "search");
      break;
    }

    case "attack": {
      if (!target) {
        if (b.lastSeenAgo > LOST_SIGHT_GRACE) {
          setState(b, "chase");
          break;
        }
        // Briefly out of sight: keep moving toward where it was, to get the
        // angle back, rather than freezing.
        if (b.lastSeen) {
          if (!b.path) routeTo(bot, world, b.lastSeen);
          moveDir = followPath(bot, world, dt);
          lookYaw = yawTo(bot.pos, b.lastSeen);
        }
        break;
      }
      // Aim at the chest, off by an error that settles over time.
      const decay = Math.exp(-d.aimSettle * dt);
      b.aimError = [b.aimError[0] * decay, b.aimError[1] * decay];
      const eye = eyeOf(bot);
      const aimAt = [target.pos[0], target.pos[1] + target.height * 0.6, target.pos[2]];
      const t = b.wobblePhase + b.stateTime;
      lookYaw = yawTo(eye, aimAt) + b.aimError[0] + d.wobble * (Math.sin(t * 1.7) + 0.5 * Math.sin(t * 4.3)) / 1.5;
      lookPitch = pitchTo(eye, aimAt) + b.aimError[1] + d.wobble * 0.6 * Math.sin(t * 2.3 + 1);

      // Trigger: after the reaction delay, in bursts, only when on target.
      b.reactionLeft -= dt;
      const onTarget = Math.abs(angleDiff(lookYaw, bot.yaw)) < FIRE_ANGLE;
      if (b.reactionLeft <= 0 && onTarget) {
        if (b.burstLeft > 0) {
          b.burstLeft -= dt;
          // Semi-automatic weapons need the trigger released between shots.
          b.semiToggle = !b.semiToggle;
          fire = w.auto ? true : b.semiToggle;
          if (b.burstLeft <= 0) b.pauseLeft = pick(rand, d.pause);
        } else if (b.pauseLeft > 0) {
          b.pauseLeft -= dt;
        } else {
          b.burstLeft = pick(rand, d.burst);
        }
      }

      // Movement: reload behind cover; otherwise keep to the weapon's range
      // and strafe so it's not a sitting duck.
      const dist = flatDist(target.pos, bot.pos);
      const [near, far] = PREFERRED_RANGE[w.id] ?? [6, 20];
      if (bot.loadout.reloading > 0) {
        if (!b.cover) {
          b.cover = findCover(bot, world, target) ?? "none";
          if (b.cover !== "none") routeTo(bot, world, b.cover);
        }
        moveDir = b.cover !== "none" ? followPath(bot, world, dt) : null;
        sprint = !!moveDir;
        crouch = !moveDir;
        break;
      }
      b.cover = null;
      if (dist > far) {
        b.repathIn -= dt;
        if (!b.path || b.repathIn <= 0) routeTo(bot, world, target.pos);
        moveDir = followPath(bot, world, dt);
      } else {
        b.path = null;
        const to = [target.pos[0] - bot.pos[0], target.pos[2] - bot.pos[2]];
        const len = Math.hypot(to[0], to[1]) || 1;
        const side = [-to[1] / len, to[0] / len];
        b.strafeLeft -= dt;
        if (b.strafeLeft <= 0) {
          b.strafe = rand() < 0.5 ? -1 : 1;
          b.strafeLeft = 0.8 + rand() * 1.2;
        }
        const back = dist < near ? -1 : 0;
        moveDir = [side[0] * b.strafe + (to[0] / len) * back, side[1] * b.strafe + (to[1] / len) * back];
        const ml = Math.hypot(moveDir[0], moveDir[1]) || 1;
        moveDir = [moveDir[0] / ml, moveDir[1] / ml];
      }
      break;
    }

    case "chase": {
      if (!b.lastSeen) {
        setState(b, "search");
        break;
      }
      if (!b.path && b.stateTime < dt * 1.5) routeTo(bot, world, b.lastSeen);
      moveDir = followPath(bot, world, dt);
      sprint = true;
      lookYaw = moveDir ? Math.atan2(-moveDir[0], -moveDir[1]) : yawTo(bot.pos, b.lastSeen);
      if ((!moveDir && b.stateTime > 0.3) || b.stateTime > CHASE_TIMEOUT) setState(b, "search");
      break;
    }

    case "search": {
      // Sweep the view left and right, then give up.
      lookYaw = bot.yaw + Math.sign(Math.sin(b.stateTime * 1.3)) * 2 * dt;
      if (b.stateTime > SEARCH_TIME) setState(b, "patrol");
      break;
    }
  }

  turnToward(bot, lookYaw, lookPitch, d.turnSpeed, dt);
  return {
    move: { ...keysFor(bot.yaw, moveDir), sprint, crouch, jump: b.jump },
    weapon: { fire, ads: false, reload: false, slot: null, scroll: 0, lastWeapon: false },
  };
}
