// ─── Animated characters ────────────────────────────────────────────────────
// One character per actor (see models.js): the SWAT model for bots, the
// Soldier for the player and their team. Each frame:
//   - position interpolated between ticks, body turned to its yaw (eased,
//     so quick turns don't snap);
//   - leg/body clips blended by engine/anim.js: idle ↔ moving by speed,
//     forward / back / strafes by direction of travel, all weights eased,
//     the stride played at the rate that keeps the feet planted;
//   - models.js then bends the legs for crouching, leans the chest toward
//     the aim and puts both hands on the shouldered weapon (bots on patrol
//     carry it lowered);
//   - a red flash when hit.
// Dead actors play Death once and disappear a few seconds later (the
// player's own body stays, for the death camera).
//
// Same interface as the box figures in actors.js, which are used instead
// when the models couldn't be loaded or graphics are set to Low.
import * as THREE from "three";
import { blend } from "../engine/anim.js";
import { createCharacterInstance } from "./models.js";

const HIDE_AFTER = 3;        // s dead before a body disappears
const WEIGHT_RATE = 9;       // 1/s easing of clip weights
const DEATH_RATE = 25;       // …into the death clip (near instant)
const CROUCH_RATE = 10;      // 1/s easing in and out of the crouch
const TURN_RATE = 14;        // 1/s easing of the body's facing
const READY_RATE = 6;        // 1/s raising/lowering the weapon
const LOW_READY = 0.55;      // rad the weapon points down when relaxed

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// modelFor(actor) → "soldier" | "enemy"; weaponOf(actor) → weapon id held.
export function createCharacters(scene, models, { modelFor, weaponOf }) {
  const root = new THREE.Group();
  scene.add(root);
  const instances = new Map(); // actor id → entry (see create())

  function create(a) {
    const inst = createCharacterInstance(models.characters[modelFor(a)]);
    root.add(inst.root);
    // Every clip is always "playing" at a weight this file controls, with
    // its time set by hand (so blended strides stay in step).
    for (const action of inst.actions.values()) {
      action.setEffectiveWeight(0);
      action.timeScale = 0;
      action.play();
    }
    return { inst, weights: new Map(), stride: 0, idle: 0, once: null, onceTime: 0, crouch: 0, yaw: a.yaw, lowered: 1 };
  }

  function animate(entry, a, dt) {
    const { inst } = entry;
    const target = blend({
      dead: a.health.dead,
      crouched: a.crouched,
      airborne: !a.onGround,
      vel: a.vel,
      yaw: a.yaw,
      hitAgo: a.hitAgo ?? Infinity,
    }, inst.clipNames);

    if (target.once !== entry.once) {
      entry.once = target.once;
      entry.onceTime = 0;
    }
    entry.onceTime += dt;
    entry.idle += dt;

    // Ease every clip's weight toward its target; the stride advances by the
    // blended moving clips' duration, so they stay phase-locked.
    const k = Math.min(1, dt * (a.health.dead ? DEATH_RATE : WEIGHT_RATE));
    let duration = 0;
    let moving = 0;
    for (const [name, action] of inst.actions) {
      const want = target.weights[name] ?? 0;
      const w = (entry.weights.get(name) ?? 0) + (want - (entry.weights.get(name) ?? 0)) * k;
      entry.weights.set(name, w);
      action.setEffectiveWeight(w < 0.001 ? 0 : w);
      if (name !== "Idle" && name !== target.once && want > 0) {
        duration += want * action.getClip().duration;
        moving += want;
      }
    }
    if (moving > 0) entry.stride = (entry.stride + (dt * target.rate) / (duration / moving)) % 1;

    for (const [name, action] of inst.actions) {
      const len = action.getClip().duration;
      if (name === entry.once) action.time = Math.min(entry.onceTime, len - 0.001);
      else if (name === "Idle") action.time = entry.idle % len;
      else action.time = entry.stride * len;
    }
    inst.mixer.update(0);
  }

  return {
    update(actors, alpha, dt) {
      const seen = new Set();
      for (const a of actors) {
        seen.add(a.id);
        if (!instances.has(a.id)) instances.set(a.id, create(a));
      }
      for (const [id, entry] of instances) {
        if (seen.has(id)) continue;
        root.remove(entry.inst.root);
        entry.inst.dispose();
        instances.delete(id);
      }

      for (const a of actors) {
        const entry = instances.get(a.id);
        const { inst } = entry;
        const dead = a.health.dead;
        inst.root.visible = !(dead && a.deadFor > HIDE_AFTER && a.id !== "player");
        if (!inst.root.visible) continue;
        inst.root.position.set(
          a.prev[0] + (a.pos[0] - a.prev[0]) * alpha,
          a.prev[1] + (a.pos[1] - a.prev[1]) * alpha,
          a.prev[2] + (a.pos[2] - a.prev[2]) * alpha,
        );
        entry.yaw += angleDiff(a.yaw, entry.yaw) * Math.min(1, dt * TURN_RATE);
        inst.root.rotation.y = entry.yaw;
        inst.showGun(dead ? null : weaponOf(a));

        animate(entry, a, dt);

        entry.crouch += ((a.crouched && !dead ? 1 : 0) - entry.crouch) * Math.min(1, dt * CROUCH_RATE);
        // Bots that aren't onto anyone carry the weapon lowered.
        const relaxed = a.brain?.state === "patrol" ? 1 : 0;
        entry.lowered += (relaxed - entry.lowered) * Math.min(1, dt * READY_RATE);
        inst.finishPose({
          pitch: dead ? 0 : a.pitch,
          weaponPitch: a.pitch - entry.lowered * LOW_READY,
          crouch: entry.crouch < 0.01 ? 0 : entry.crouch,
          kickAgo: a.firedAgo ?? Infinity,
        });
        inst.setFlash(a.hitFlash > 0);
      }
    },
    dispose() {
      for (const { inst } of instances.values()) inst.dispose();
      instances.clear();
      scene.remove(root);
    },
  };
}
