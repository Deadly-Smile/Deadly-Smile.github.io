// ─── Player movement and collision ──────────────────────────────────────────
// A body is an upright box (BODY_RADIUS wide, `height` tall) moved through a
// world of axis-aligned boxes one axis at a time: X, then Z, then Y. Hitting
// something on X or Z slides along it (only that axis stops); a ledge up to
// STEP_HEIGHT above the feet is stepped onto instead, which is also how
// stairs work and how a jump "mantles" onto low cover.
//
// Pure: no three.js/DOM. `stepPlayer` mutates the player in place (it runs
// at 60 Hz for every body; no need to allocate a new object per tick).
import { bodyBox, boxesOverlap, overlapsAny, BODY_RADIUS, BODY_HEIGHT, STEP_HEIGHT } from "./geometry.js";

export const WALK_SPEED = 4.5;
export const SPRINT_SPEED = 6.8;
export const CROUCH_SPEED = 2.2;
export const GROUND_ACCEL = 50;   // m/s² toward the wanted velocity
export const AIR_ACCEL = 10;
export const GRAVITY = 22;
export const JUMP_SPEED = 6.6;    // ≈ 1 m jump
export const MAX_FALL_SPEED = 20; // also keeps a tick's movement well under any box's thickness
export const CROUCH_HEIGHT = 1.2;
export const EYE_BELOW_TOP = 0.2; // eye is this far below the top of the body
export const MAX_PITCH = Math.PI / 2 - 0.01;

export function createPlayer(spawn) {
  return {
    pos: [...spawn.pos],
    prev: [...spawn.pos],   // position at the previous tick, for render interpolation
    vel: [0, 0, 0],
    yaw: spawn.yaw ?? 0,
    pitch: 0,
    onGround: true,
    crouched: false,
    height: BODY_HEIGHT,
  };
}

export const eyeHeight = (p) => p.height - EYE_BELOW_TOP;

// Mouse look. dx/dy are already scaled to radians by the caller.
export function look(p, dx, dy) {
  p.yaw -= dx;
  p.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p.pitch - dy));
}

// Unit horizontal direction the keys ask for, relative to `yaw` (0 = facing
// -z). [0, 0] when no key (or opposing keys) is held. Diagonals aren't faster.
export function wishDir(input, yaw) {
  const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (!f && !s) return [0, 0];
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const x = -sin * f + cos * s;
  const z = -cos * f - sin * s;
  const len = Math.hypot(x, z);
  return [x / len, z / len];
}

const hitsAt = (p, boxes) => {
  const body = bodyBox(p.pos, { height: p.height });
  return boxes.filter(b => boxesOverlap(body, b));
};

function moveHorizontal(p, axis, delta, boxes) {
  if (!delta) return;
  p.pos[axis] += delta;
  const hits = hitsAt(p, boxes);
  if (!hits.length) return;

  // Low enough to step onto (and room to stand up there)?
  const top = Math.max(...hits.map(b => b.max[1]));
  if (top - p.pos[1] <= STEP_HEIGHT + 1e-9) {
    const y = p.pos[1];
    p.pos[1] = top;
    if (!overlapsAny(bodyBox(p.pos, { height: p.height }), boxes)) {
      if (p.vel[1] < 0) p.vel[1] = 0;
      p.onGround = true;
      return;
    }
    p.pos[1] = y;
  }

  // Blocked: stop flush against the nearest face; the other axis still moves
  // (that's what makes walls slide instead of stick).
  p.pos[axis] = delta > 0
    ? Math.min(...hits.map(b => b.min[axis])) - BODY_RADIUS
    : Math.max(...hits.map(b => b.max[axis])) + BODY_RADIUS;
  p.vel[axis] = 0;
}

function moveVertical(p, delta, boxes) {
  p.onGround = false;
  p.pos[1] += delta;
  if (p.pos[1] <= 0) {
    p.pos[1] = 0;
    p.vel[1] = 0;
    p.onGround = true;
    return;
  }
  const hits = hitsAt(p, boxes);
  if (!hits.length) return;
  if (delta < 0) {
    p.pos[1] = Math.max(...hits.map(b => b.max[1]));
    p.onGround = true;
  } else {
    p.pos[1] = Math.min(...hits.map(b => b.min[1])) - p.height; // head bump
  }
  p.vel[1] = 0;
}

// Walking off a step (not a cliff) should follow the ground down instead of
// briefly falling — otherwise going downstairs is a series of tiny hops.
function snapDown(p, boxes) {
  const [x, y, z] = p.pos;
  const probe = { min: [x - BODY_RADIUS, y - STEP_HEIGHT, z - BODY_RADIUS], max: [x + BODY_RADIUS, y, z + BODY_RADIUS] };
  // The floor counts if it's within a step; a box top above it wins.
  let ground = y - STEP_HEIGHT <= 0 ? 0 : -Infinity;
  for (const b of boxes) {
    if (boxesOverlap(probe, b) && b.max[1] <= y && b.max[1] > ground) ground = b.max[1];
  }
  if (ground === -Infinity) return;
  p.pos[1] = ground;
  p.vel[1] = 0;
  p.onGround = true;
}

// One simulation tick. `input`: { forward, back, left, right, jump, sprint, crouch }.
export function stepPlayer(p, input, dt, boxes) {
  p.prev[0] = p.pos[0];
  p.prev[1] = p.pos[1];
  p.prev[2] = p.pos[2];

  // Crouch at once; stand up only if there's headroom.
  if (input.crouch && !p.crouched) {
    p.crouched = true;
    p.height = CROUCH_HEIGHT;
  } else if (!input.crouch && p.crouched && !overlapsAny(bodyBox(p.pos, { height: BODY_HEIGHT }), boxes)) {
    p.crouched = false;
    p.height = BODY_HEIGHT;
  }

  const [wx, wz] = wishDir(input, p.yaw);
  const speed = p.crouched ? CROUCH_SPEED : input.sprint && input.forward ? SPRINT_SPEED : WALK_SPEED;
  const dvx = wx * speed - p.vel[0];
  const dvz = wz * speed - p.vel[2];
  const dv = Math.hypot(dvx, dvz);
  const maxDv = (p.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt;
  const k = dv > maxDv ? maxDv / dv : 1;
  p.vel[0] += dvx * k;
  p.vel[2] += dvz * k;

  let jumped = false;
  if (input.jump && p.onGround) {
    p.vel[1] = JUMP_SPEED;
    p.onGround = false;
    jumped = true;
  }
  p.vel[1] = Math.max(p.vel[1] - GRAVITY * dt, -MAX_FALL_SPEED);

  const wasOnGround = p.onGround;
  moveHorizontal(p, 0, p.vel[0] * dt, boxes);
  moveHorizontal(p, 2, p.vel[2] * dt, boxes);
  moveVertical(p, p.vel[1] * dt, boxes);
  if (wasOnGround && !p.onGround && !jumped) snapDown(p, boxes);
}
