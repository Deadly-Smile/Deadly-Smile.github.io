// ─── Drops on the ground ────────────────────────────────────────────────────
// Ammo packs (green crates), guns (a box model per weapon) and grenades,
// hovering and turning slowly so they stand out, blinking in their last
// seconds before they disappear. Meshes are made when a drop appears and
// freed when it's taken or expires; geometries/materials are shared.
import * as THREE from "three";
import { disposeObject } from "./renderer.js";

const BLINK_FROM = 5; // s left when blinking starts

const GUN_SIZE = { smg: [0.08, 0.12, 0.45], rifle: [0.08, 0.12, 0.75], sniper: [0.08, 0.12, 0.95], shotgun: [0.09, 0.11, 0.8] };

export function createPickupMeshes(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(0.1, 10, 8);
  const mats = {
    ammo: new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.6, emissive: 0x14532d, emissiveIntensity: 0.6 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, emissive: 0x854d0e, emissiveIntensity: 0.5 }),
    gun: new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.5, emissive: 0x1e3a8a, emissiveIntensity: 0.5 }),
    grenade: new THREE.MeshStandardMaterial({ color: 0x5f6e38, roughness: 0.7, emissive: 0x365314, emissiveIntensity: 0.5 }),
  };
  const meshes = new Map(); // drop id → Object3D
  let time = 0;

  const build = (d) => {
    const g = new THREE.Group();
    const add = (mat, w, h, dd, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(unit, mat);
      m.scale.set(w, h, dd);
      m.position.set(x, y, z);
      g.add(m);
    };
    if (d.kind === "ammo") {
      add(mats.ammo, 0.4, 0.25, 0.3);
      add(mats.stripe, 0.41, 0.06, 0.31);
    } else if (d.kind === "gun") {
      const [w, h, len] = GUN_SIZE[d.weapon] ?? [0.08, 0.12, 0.6];
      add(mats.gun, w, h, len);
      add(mats.gun, w * 0.8, h * 1.4, 0.06, 0, -h, len * 0.1);
    } else {
      g.add(new THREE.Mesh(sphere, mats.grenade));
    }
    root.add(g);
    return g;
  };

  return {
    update(drops, dt) {
      time += dt;
      const seen = new Set();
      for (const d of drops) {
        seen.add(d.id);
        let g = meshes.get(d.id);
        if (!g) meshes.set(d.id, g = build(d));
        g.position.set(d.pos[0], d.pos[1] + 0.35 + Math.sin(time * 2.5 + d.id) * 0.06, d.pos[2]);
        g.rotation.y = time * 1.2 + d.id;
        g.visible = d.ttl > BLINK_FROM || Math.sin(time * 18) > 0;
      }
      for (const [id, g] of meshes) {
        if (seen.has(id)) continue;
        root.remove(g);
        meshes.delete(id);
      }
    },
    dispose() {
      scene.remove(root);
      disposeObject(root);
      Object.values(mats).forEach(m => m.dispose());
      unit.dispose();
      sphere.dispose();
    },
  };
}
