// ─── First-person weapon ("view model") ─────────────────────────────────────
// Each weapon is a few boxes, built once and swapped by visibility. Lives in
// the renderer's separate view-model scene (camera at the origin, looking
// down -z), so positions here are relative to the eye.
//
// All motion is cosmetic and computed per frame from the loadout's state:
// walk bob, recoil kick, reload dip, draw (switch) raise, melee swing, throw,
// aiming down sights. Nothing here affects where shots go.
import * as THREE from "three";
import { disposeObject } from "./renderer.js";

const HIP = new THREE.Vector3(0.17, -0.16, -0.62);
const ADS = new THREE.Vector3(0, -0.085, -0.5);

const COLORS = { dark: 0x3a414b, metal: 0x6b7480, wood: 0x8a5530, olive: 0x5f6e38, blade: 0xd8dee8, grip: 0x24292f };

// [w, h, d, x, y, z, color]; barrel along -z. `muzzle` is where the flash goes.
const MODELS = {
  rifle: {
    parts: [[0.07, 0.09, 0.42, 0, 0, 0, "dark"], [0.03, 0.03, 0.26, 0, 0.015, -0.32, "metal"],
      [0.05, 0.14, 0.07, 0, -0.1, -0.06, "metal"], [0.06, 0.08, 0.18, 0, -0.01, 0.28, "dark"],
      [0.02, 0.035, 0.06, 0, 0.06, -0.02, "metal"], [0.035, 0.1, 0.05, 0, -0.09, 0.1, "grip"]],
    muzzle: [0, 0.015, -0.46], sight: 0.075,
  },
  smg: {
    parts: [[0.065, 0.09, 0.3, 0, 0, 0, "metal"], [0.03, 0.03, 0.12, 0, 0.015, -0.21, "dark"],
      [0.04, 0.2, 0.05, 0, -0.13, -0.04, "dark"], [0.035, 0.1, 0.05, 0, -0.09, 0.09, "grip"],
      [0.02, 0.03, 0.05, 0, 0.06, 0, "dark"]],
    muzzle: [0, 0.015, -0.28], sight: 0.075,
  },
  sniper: {
    parts: [[0.07, 0.09, 0.5, 0, 0, 0.02, "olive"], [0.03, 0.03, 0.42, 0, 0.015, -0.44, "dark"],
      [0.05, 0.05, 0.22, 0, 0.085, -0.02, "dark"], [0.05, 0.08, 0.06, 0, -0.08, -0.04, "metal"],
      [0.06, 0.1, 0.2, 0, -0.02, 0.32, "olive"]],
    muzzle: [0, 0.015, -0.66], sight: 0.085,
  },
  shotgun: {
    parts: [[0.07, 0.08, 0.4, 0, 0, 0, "wood"], [0.045, 0.045, 0.34, 0, 0.03, -0.34, "dark"],
      [0.05, 0.04, 0.16, 0, -0.03, -0.28, "wood"], [0.06, 0.09, 0.2, 0, -0.03, 0.28, "wood"]],
    muzzle: [0, 0.03, -0.52], sight: 0.07,
  },
  pistol: {
    parts: [[0.04, 0.05, 0.2, 0, 0, -0.03, "dark"], [0.035, 0.11, 0.05, 0, -0.07, 0.04, "grip"]],
    muzzle: [0, 0.01, -0.14], sight: 0.05,
  },
  knife: {
    parts: [[0.012, 0.03, 0.2, 0, 0.01, -0.12, "blade"], [0.026, 0.035, 0.1, 0, 0, 0.03, "grip"],
      [0.05, 0.012, 0.012, 0, 0.005, -0.02, "metal"]],
    muzzle: [0, 0, -0.2], sight: 0,
  },
  grenade: {
    parts: [[0.07, 0.08, 0.07, 0, 0, 0, "olive"], [0.02, 0.025, 0.02, 0, 0.05, 0, "metal"],
      [0.01, 0.05, 0.015, 0.03, 0.035, 0, "metal"]],
    muzzle: [0, 0, 0], sight: 0,
  },
};

// Exponential approach of `current` toward `target` at `rate` per second.
const approach = (current, target, rate, dt) => current + (target - current) * Math.min(1, rate * dt);

export function createViewModel(vmScene) {
  const root = new THREE.Group();
  vmScene.add(root);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const mats = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3 })]));
  const models = {};
  for (const [id, def] of Object.entries(MODELS)) {
    const g = new THREE.Group();
    for (const [w, h, d, x, y, z, col] of def.parts) {
      const m = new THREE.Mesh(box, mats[col]);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      g.add(m);
    }
    g.visible = false;
    root.add(g);
    models[id] = g;
  }

  // Muzzle flash: two crossed additive quads, shown for a few frames per shot.
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flash = new THREE.Group();
  const quad = new THREE.PlaneGeometry(0.16, 0.16);
  const q1 = new THREE.Mesh(quad, flashMat);
  const q2 = new THREE.Mesh(quad, flashMat);
  q2.rotation.y = Math.PI / 2;
  flash.add(q1, q2);
  flash.visible = false;
  root.add(flash);

  let current = null;
  let adsBlend = 0;
  let kick = 0;          // recoil offset, decays
  let flashTime = 0;
  let swing = 0;         // melee/throw animation, 1 → 0
  let swingKind = "melee";
  let bobPhase = 0;

  return {
    // Cues from simulation events.
    shot() {
      kick = Math.min(1.5, kick + 1);
      flashTime = 0.05;
      flash.rotation.z = Math.random() * Math.PI;
    },
    melee() { swing = 1; swingKind = "melee"; },
    thrown() { swing = 1; swingKind = "throw"; },

    // state: { weapon, ads, scoped, hidden, reloadFrac (0..1, 1 = not
    //          reloading), drawFrac (0..1, 1 = drawn), speedFrac, onGround }
    update(dt, s) {
      if (current !== s.weapon) {
        if (current) models[current].visible = false;
        current = s.weapon;
        models[current].visible = true;
      }
      const def = MODELS[current];
      const model = models[current];

      adsBlend = approach(adsBlend, s.ads ? 1 : 0, 14, dt);
      kick = approach(kick, 0, 16, dt);
      flashTime -= dt;
      swing = Math.max(0, swing - dt * (swingKind === "throw" ? 2.5 : 3.5));

      const moving = s.onGround ? Math.min(1, s.speedFrac) : 0;
      bobPhase += dt * (6 + 5 * moving);
      const bobAmp = moving * (1 - adsBlend * 0.85);

      const pos = HIP.clone().lerp(ADS, adsBlend);
      // Line the sight up with the screen centre when aiming.
      pos.y -= def.sight * adsBlend * 0.4;
      pos.x += Math.sin(bobPhase) * 0.012 * bobAmp;
      pos.y += Math.abs(Math.cos(bobPhase)) * 0.012 * bobAmp;
      pos.z += kick * 0.04;
      pos.y += kick * 0.006;

      const reloadDip = Math.sin(Math.PI * (1 - s.reloadFrac));
      pos.y -= reloadDip * 0.12 + (1 - s.drawFrac) * 0.3;

      let rx = kick * 0.08 + reloadDip * 0.6;
      let ry = 0;
      let rz = reloadDip * 0.3;
      if (swing > 0) {
        const p = 1 - swing;
        if (swingKind === "melee") {
          ry = Math.sin(p * Math.PI) * 0.9;
          rx -= Math.sin(p * Math.PI) * 0.4;
          pos.x -= Math.sin(p * Math.PI) * 0.12;
          pos.z -= Math.sin(p * Math.PI) * 0.1;
        } else {
          pos.z -= Math.sin(p * Math.PI) * 0.25;
          pos.y += Math.sin(p * Math.PI) * 0.12;
          rx -= Math.sin(p * Math.PI) * 0.6;
        }
      }
      // A thrown grenade is in the air; hide the one in hand until "drawn" again.
      model.visible = !(current === "grenade" && swingKind === "throw" && swing > 0 && swing < 0.6);

      root.position.copy(pos);
      root.rotation.set(rx, ry, rz);
      // The scope covers the screen; hide the gun behind it (and when dead).
      root.visible = !s.scoped && !s.hidden;

      flash.visible = flashTime > 0 && !!def.muzzle && current !== "knife" && current !== "grenade";
      if (flash.visible) flash.position.set(...def.muzzle);
    },
    dispose() {
      vmScene.remove(root);
      disposeObject(root);
    },
  };
}
