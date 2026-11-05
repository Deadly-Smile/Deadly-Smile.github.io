// ─── Animated characters ────────────────────────────────────────────────────
// One character per actor (see models.js): the SWAT model for bots, the
// Soldier for the player and their team. Each frame: position interpolated
// between ticks, facing its yaw, the animation picked by engine/anim.js
// (cross-faded, strafes included), legs bent when crouching, chest leaning
// toward its aim, the weapon it holds in its hand pointing where it aims, a
// red flash when hit. Dead actors play Death once and disappear a few
// seconds later (the player's own body stays, for the death camera).
//
// Same interface as the box figures in actors.js, which are used instead
// when the models couldn't be loaded.
import * as THREE from "three";
import { pickClip, moveDirection } from "../engine/anim.js";
import { createCharacterInstance } from "./models.js";

const FADE = 0.18;           // s cross-fade between clips
const HIDE_AFTER = 3;        // s dead before a body disappears
const CROUCH_RATE = 10;      // 1/s easing in and out of the crouch
// Clips that hold the weapon forward in the hand; in the others (walk,
// unarmed run, strafes) the arms swing, so it's held at the chest instead.
const ARMED_CLIPS = new Set(["Idle", "Idle_Shoot", "Run_Shoot", "HitReact", "Death"]);

// modelFor(actor) → "soldier" | "enemy"; weaponOf(actor) → weapon id held.
export function createCharacters(scene, models, { modelFor, weaponOf }) {
  const root = new THREE.Group();
  scene.add(root);
  const instances = new Map(); // actor id → { inst, clip }

  function play(entry, choice) {
    const { inst } = entry;
    const next = inst.actions.get(choice.clip);
    if (!next) return;
    if (entry.clip !== choice.clip) {
      const prev = entry.clip && inst.actions.get(entry.clip);
      next.reset();
      next.setLoop(choice.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = choice.once;
      next.fadeIn(FADE).play();
      prev?.fadeOut(FADE);
      entry.clip = choice.clip;
    }
    next.timeScale = choice.timeScale;
  }

  return {
    update(actors, alpha, dt) {
      const seen = new Set();
      for (const a of actors) {
        seen.add(a.id);
        if (!instances.has(a.id)) {
          const inst = createCharacterInstance(models.characters[modelFor(a)]);
          root.add(inst.root);
          instances.set(a.id, { inst, clip: null, crouch: 0 });
        }
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
        inst.root.rotation.y = a.yaw;
        inst.showGun(dead ? null : weaponOf(a));

        play(entry, pickClip({
          dead,
          crouched: a.crouched,
          airborne: !a.onGround,
          speed: Math.hypot(a.vel[0], a.vel[2]),
          dir: moveDirection(a.vel, a.yaw),
          firedAgo: a.firedAgo ?? Infinity,
          hitAgo: a.hitAgo ?? Infinity,
        }, inst.clipNames));
        inst.mixer.update(dt);
        entry.crouch += ((a.crouched && !dead ? 1 : 0) - entry.crouch) * Math.min(1, dt * CROUCH_RATE);
        inst.finishPose({
          pitch: dead ? 0 : a.pitch,
          crouch: entry.crouch < 0.01 ? 0 : entry.crouch,
          followHand: ARMED_CLIPS.has(entry.clip),
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
