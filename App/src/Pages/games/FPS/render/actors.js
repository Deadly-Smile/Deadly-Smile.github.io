// ─── Bot figures ────────────────────────────────────────────────────────────
// Box figures sized to their hitboxes (what you see is what you can hit):
// swinging legs while walking, a gun that tilts with the bot's aim, a visor
// showing which way it faces, a muzzle flash when it fires, a red flash when
// hit, and a fall backwards when killed. Crouching squashes the figure to
// the crouched height. Positions are interpolated between ticks.
import * as THREE from "three";
import { disposeObject } from "./renderer.js";
import { HITBOX_RADIUS, HEAD_SIZE } from "../engine/damage.js";
import { BODY_HEIGHT } from "../engine/geometry.js";

const FALL_TIME = 0.45;
const HIDE_AFTER = 3;          // s dead before the body disappears
const LEG_H = 0.75;
const TEAM_COLORS = { enemy: 0xc2410c, a: 0x2563eb, b: 0xea580c };

export function createActorMeshes(scene, actors) {
  const root = new THREE.Group();
  scene.add(root);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.4 });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flashGeo = new THREE.PlaneGeometry(0.25, 0.25);

  const part = (mat, w, h, d, x, y, z, parent) => {
    const m = new THREE.Mesh(unit, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const figures = actors.map(a => {
    const skin = new THREE.MeshStandardMaterial({ color: TEAM_COLORS[a.team] ?? 0x9ca3af, roughness: 0.7, emissive: 0xff0000, emissiveIntensity: 0 });
    const group = new THREE.Group();      // at the feet, turns with yaw, falls on death
    const body = new THREE.Group();       // squashed when crouching
    group.add(body);
    const w = HITBOX_RADIUS * 2;
    const torsoH = BODY_HEIGHT - HEAD_SIZE - LEG_H;
    part(skin, w, torsoH, w * 0.7, 0, LEG_H + torsoH / 2, 0, body);
    part(skin, HEAD_SIZE, HEAD_SIZE, HEAD_SIZE, 0, BODY_HEIGHT - HEAD_SIZE / 2, 0, body);
    part(visorMat, HEAD_SIZE * 0.8, HEAD_SIZE * 0.25, 0.02, 0, BODY_HEIGHT - HEAD_SIZE * 0.4, -HEAD_SIZE / 2 - 0.01, body);
    const legs = [-1, 1].map(side => {
      const hip = new THREE.Group();
      hip.position.set(side * w * 0.25, LEG_H, 0);
      part(darkMat, w * 0.38, LEG_H, w * 0.45, 0, -LEG_H / 2, 0, hip);
      body.add(hip);
      return hip;
    });
    // Gun held at shoulder height, pivoting with the aim pitch.
    const arms = new THREE.Group();
    arms.position.set(w * 0.3, LEG_H + torsoH * 0.8, -0.1);
    part(darkMat, 0.07, 0.09, 0.6, 0, 0, -0.25, arms);
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(0, 0, -0.6);
    flash.visible = false;
    arms.add(flash);
    body.add(arms);
    root.add(group);
    return { group, body, legs, arms, flash, skin, phase: Math.random() * 6 };
  });

  return {
    update(alpha, dt) {
      actors.forEach((a, i) => {
        const f = figures[i];
        const dead = a.health.dead;
        f.group.visible = !(dead && a.deadFor > HIDE_AFTER);
        if (!f.group.visible) return;
        f.group.position.set(
          a.prev[0] + (a.pos[0] - a.prev[0]) * alpha,
          a.prev[1] + (a.pos[1] - a.prev[1]) * alpha,
          a.prev[2] + (a.pos[2] - a.prev[2]) * alpha,
        );
        const fall = dead ? Math.min(1, a.deadFor / FALL_TIME) : 0;
        f.group.rotation.set(fall * Math.PI / 2, a.yaw, 0, "YXZ");
        f.body.scale.y = a.height / BODY_HEIGHT;

        const speed = dead ? 0 : Math.hypot(a.vel[0], a.vel[2]);
        f.phase += dt * speed * 2.2;
        const swing = Math.sin(f.phase) * Math.min(0.7, speed * 0.12);
        f.legs[0].rotation.x = swing;
        f.legs[1].rotation.x = -swing;
        f.arms.rotation.x = dead ? 0 : a.pitch;

        f.flash.visible = !dead && a.flash > 0;
        if (f.flash.visible) f.flash.rotation.z = Math.random() * Math.PI;
        f.skin.emissiveIntensity = a.hitFlash > 0 ? 0.8 : 0;
      });
    },
    dispose() {
      scene.remove(root);
      disposeObject(root);
    },
  };
}
