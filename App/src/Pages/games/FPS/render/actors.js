// ─── Training dummies ───────────────────────────────────────────────────────
// Box figures whose body and head match their hitboxes exactly (what you see
// is what you can hit). A chest plate and visor show which way each one
// faces, which matters for knife backstabs. They flash red when hit and tip
// over backwards when killed. Replaced by animated bots in FPS-6.
import * as THREE from "three";
import { disposeObject } from "./renderer.js";
import { HITBOX_RADIUS, HEAD_SIZE } from "../engine/damage.js";

const FALL_TIME = 0.45;

export function createDummyMeshes(scene, dummies) {
  const root = new THREE.Group();
  scene.add(root);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 });

  const figures = dummies.map(d => {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7, emissive: 0xff0000, emissiveIntensity: 0 });
    const w = HITBOX_RADIUS * 2;
    const bodyH = d.height - HEAD_SIZE;
    const body = new THREE.Mesh(unit, skin);
    body.scale.set(w, bodyH, w);
    body.position.y = bodyH / 2;
    const head = new THREE.Mesh(unit, skin);
    head.scale.setScalar(HEAD_SIZE);
    head.position.y = bodyH + HEAD_SIZE / 2;
    const plate = new THREE.Mesh(unit, plateMat);
    plate.scale.set(w * 0.6, bodyH * 0.35, 0.02);
    plate.position.set(0, bodyH * 0.7, -w / 2 - 0.01);
    const visor = new THREE.Mesh(unit, visorMat);
    visor.scale.set(HEAD_SIZE * 0.8, HEAD_SIZE * 0.25, 0.02);
    visor.position.set(0, bodyH + HEAD_SIZE * 0.6, -HEAD_SIZE / 2 - 0.01);
    group.add(body, head, plate, visor);
    root.add(group);
    return { group, skin };
  });

  return {
    update() {
      dummies.forEach((d, i) => {
        const { group, skin } = figures[i];
        group.position.set(...d.pos);
        // Tip over backwards around the feet over FALL_TIME, then lie there.
        const fall = d.health.dead ? Math.min(1, d.deadFor / FALL_TIME) : 0;
        group.rotation.set(fall * Math.PI / 2, d.yaw, 0, "YXZ");
        skin.emissiveIntensity = d.hitFlash > 0 ? 0.8 : 0;
      });
    },
    dispose() {
      scene.remove(root);
      disposeObject(root);
    },
  };
}
