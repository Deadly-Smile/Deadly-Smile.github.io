// ─── World effects ──────────────────────────────────────────────────────────
// Bullet holes, impact puffs, grenades in flight and explosions. Everything
// is pooled and allocated up front — nothing is created or freed per shot,
// so firing doesn't churn the GPU or the garbage collector.
//
// The two point lights (muzzle and explosion) always exist and only change
// intensity: adding/removing lights would recompile every material's shader.
import * as THREE from "three";
import { disposeObject } from "./renderer.js";
import { cloneProp } from "./models.js";

const MAX_DECALS = 128;
const MAX_PUFFS = 24;
const MAX_GRENADES = 8;
const MAX_BLASTS = 4;
const MAX_TRACERS = 24;
const PUFF_LIFE = 0.18;
const TRACER_LIFE = 0.08;
const BLAST_LIFE = 0.4;

const Z = new THREE.Vector3(0, 0, 1);
const DUST = 0xd6c7a8;

// `assets` is the loaded models.js set (for the grenade model), or null.
export function createEffects(scene, assets = null) {
  const root = new THREE.Group();
  scene.add(root);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);

  // Bullet holes: one instanced quad, written round-robin.
  const decals = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.05, 8),
    new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    MAX_DECALS,
  );
  decals.frustumCulled = false;
  m4.compose(zero, q.identity(), zero);
  for (let i = 0; i < MAX_DECALS; i++) decals.setMatrixAt(i, m4);
  root.add(decals);
  let nextDecal = 0;

  // Impact puffs: small spheres that grow and fade.
  const puffGeo = new THREE.SphereGeometry(0.06, 6, 4);
  const puffs = Array.from({ length: MAX_PUFFS }, () => {
    const mesh = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: DUST, transparent: true, depthWrite: false }));
    mesh.visible = false;
    root.add(mesh);
    return { mesh, life: 0 };
  });
  let nextPuff = 0;

  const grenadeGeo = new THREE.SphereGeometry(0.08, 10, 8);
  const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x4d5a2c, roughness: 0.7 });
  const shared = []; // model clones: geometry/materials belong to the loaded set
  const grenadeMeshes = Array.from({ length: MAX_GRENADES }, () => {
    let mesh;
    if (assets) {
      // The model's origin is at its top; hang it so it's centred on the
      // simulated position.
      mesh = new THREE.Group();
      const g = cloneProp(assets.grenade);
      g.position.y = g.userData.height / 2;
      mesh.add(g);
      shared.push(g);
    } else {
      mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
    }
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  });

  const blastGeo = new THREE.SphereGeometry(1, 16, 12);
  const blasts = Array.from({ length: MAX_BLASTS }, () => {
    const mesh = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.visible = false;
    root.add(mesh);
    return { mesh, life: 0, radius: 1 };
  });
  let nextBlast = 0;

  // Tracers: a short-lived line per bullet, so incoming fire shows where it
  // came from.
  const tracers = Array.from({ length: MAX_TRACERS }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, depthWrite: false }));
    line.visible = false;
    line.frustumCulled = false;
    root.add(line);
    return { line, life: 0 };
  });
  let nextTracer = 0;

  const muzzleLight = new THREE.PointLight(0xffc36b, 0, 8, 2);
  const blastLight = new THREE.PointLight(0xff9a40, 0, 18, 2);
  root.add(muzzleLight, blastLight);
  let muzzleTime = 0;
  let blastLightTime = 0;

  return {
    bulletHole(point, normal) {
      n.set(...normal);
      v.set(...point).addScaledVector(n, 0.004);
      q.setFromUnitVectors(Z, n);
      m4.compose(v, q, one.set(1, 1, 1).multiplyScalar(0.7 + Math.random() * 0.6));
      decals.setMatrixAt(nextDecal, m4);
      decals.instanceMatrix.needsUpdate = true;
      nextDecal = (nextDecal + 1) % MAX_DECALS;
    },
    // Dust by default; hits on bodies pass a colour.
    impact(point, color = DUST) {
      const p = puffs[nextPuff];
      nextPuff = (nextPuff + 1) % MAX_PUFFS;
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(...point);
      p.life = PUFF_LIFE;
      p.mesh.visible = true;
    },
    tracer(from, to) {
      const t = tracers[nextTracer];
      nextTracer = (nextTracer + 1) % MAX_TRACERS;
      const attr = t.line.geometry.attributes.position;
      attr.setXYZ(0, ...from);
      attr.setXYZ(1, ...to);
      attr.needsUpdate = true;
      t.life = TRACER_LIFE;
      t.line.visible = true;
    },
    muzzle(position) {
      muzzleLight.position.set(...position);
      muzzleTime = 0.05;
    },
    explosion(point, radius) {
      const b = blasts[nextBlast];
      nextBlast = (nextBlast + 1) % MAX_BLASTS;
      b.mesh.position.set(...point);
      b.life = BLAST_LIFE;
      b.radius = radius;
      b.mesh.visible = true;
      blastLight.position.set(point[0], point[1] + 1, point[2]);
      blastLightTime = 0.3;
    },
    // Grenades in flight, interpolated between ticks like the player.
    setGrenades(list, alpha) {
      grenadeMeshes.forEach((mesh, i) => {
        const g = list[i];
        mesh.visible = !!g;
        if (g) {
          mesh.position.set(
            g.prev[0] + (g.pos[0] - g.prev[0]) * alpha,
            g.prev[1] + (g.pos[1] - g.prev[1]) * alpha,
            g.prev[2] + (g.pos[2] - g.prev[2]) * alpha,
          );
        }
      });
    },
    update(dt) {
      for (const p of puffs) {
        if (!p.mesh.visible) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
          continue;
        }
        const k = 1 - p.life / PUFF_LIFE;
        p.mesh.scale.setScalar(1 + k * 2.5);
        p.mesh.material.opacity = 0.7 * (1 - k);
      }
      for (const b of blasts) {
        if (!b.mesh.visible) continue;
        b.life -= dt;
        if (b.life <= 0) {
          b.mesh.visible = false;
          continue;
        }
        const k = 1 - b.life / BLAST_LIFE;
        b.mesh.scale.setScalar(b.radius * (0.2 + 0.6 * Math.sqrt(k)));
        b.mesh.material.opacity = 0.85 * (1 - k);
      }
      for (const t of tracers) {
        if (!t.line.visible) continue;
        t.life -= dt;
        t.line.visible = t.life > 0;
        t.line.material.opacity = 0.9 * Math.max(0, t.life / TRACER_LIFE);
      }
      muzzleTime -= dt;
      muzzleLight.intensity = muzzleTime > 0 ? 6 : 0;
      blastLightTime -= dt;
      blastLight.intensity = blastLightTime > 0 ? 60 * (blastLightTime / 0.3) : 0;
    },
    dispose() {
      scene.remove(root);
      for (const g of shared) g.parent.remove(g);
      disposeObject(root);
    },
  };
}
