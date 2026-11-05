// ─── Character and weapon models ────────────────────────────────────────────
// Realistic low-poly characters and guns (credits and licences in
// public/fps/models/CREDITS.md): Quaternius' SWAT (bots) and Soldier (the
// player and their team), rigged on the same skeleton with gun-holding
// animations, plus one model per weapon. Loaded once — only when the game
// is opened — and shared by every session; instances are cheap clones.
//
// loadModels() resolves to null if anything fails to load, and the game
// falls back to its box figures: models are an enhancement, never a
// requirement.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BODY_HEIGHT } from "../engine/geometry.js";

const BASE = `${import.meta.env.BASE_URL}fps/models/`;
const CHARACTERS = { enemy: "swat", soldier: "soldier" };
const WEAPON_IDS = ["rifle", "smg", "sniper", "shotgun", "pistol", "knife", "grenade"];
// Real-world length (m) of each weapon's longest side.
const LENGTH = { rifle: 0.85, smg: 0.5, sniper: 1.15, shotgun: 0.95, pistol: 0.22, knife: 0.3, grenade: 0.12 };
// The weapon files' own axes: which local axis is the barrel (muzzle end
// positive) and which is up. The guns share one convention; the knife's
// blade points along +y.
const AXES = {
  default: { forward: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
  knife: { forward: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(1, 0, 0) },
  grenade: { forward: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
};
// Bone whose position a held weapon follows (three drops the "." from
// "Wrist.R"). The weapon tracks the hand's position but always points where
// the character aims: the clips include unarmed runs whose swinging wrists
// would otherwise wave the gun around.
const HAND_BONE = "WristR";
// Grip relative to the wrist, in the character's frame (m): forward into
// the closed hand.
const GRIP_OFFSET = new THREE.Vector3(0, -0.02, -0.07);
// In clips where the arms swing (walk, unarmed run, strafes) the weapon is
// held at this point relative to the chest instead (m; +x right, -z ahead).
const CHEST_HOLD = new THREE.Vector3(0.14, -0.28, -0.32);
// The models have no crouch clip: crouching lowers the body by this much (m)
// and bends the knees forward (two-bone IK) to keep the feet where the clip
// put them. The rig's feet hang off the root, not the shins.
const CROUCH_DROP = 0.55;
// Fraction of the aim pitch the chest leans by.
const AIM_LEAN = 0.6;

let loading = null;

export function loadModels() {
  loading ??= load().catch((err) => {
    console.warn("FPS models failed to load; using box figures", err);
    return null;
  });
  return loading;
}

async function load() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const get = (path) => loader.loadAsync(`${BASE}${path}`);
  const [chars, weapons] = await Promise.all([
    Promise.all(Object.values(CHARACTERS).map(f => get(`${f}.glb`))),
    Promise.all(WEAPON_IDS.map(id => get(`guns/${id}.glb`))),
  ]);
  // Each weapon, rotated to a common frame: barrel toward -z, up +y, real size.
  const raw = {};
  WEAPON_IDS.forEach((id, i) => { raw[id] = orient(weapons[i].scene, id); });
  const characters = {};
  Object.keys(CHARACTERS).forEach((kind, i) => { characters[kind] = prepareCharacter(chars[i], raw); });
  const guns = {};
  for (const id of WEAPON_IDS) guns[id] = forView(raw[id], id);
  return { characters, guns, grenade: guns.grenade };
}

// Wraps a weapon scene so that, at the wrapper's origin (its grip), the
// barrel points toward -z and its top toward +y, at its real length.
function orient(scene, id) {
  const { forward, up } = AXES[id] ?? AXES.default;
  const from = new THREE.Matrix4().makeBasis(forward, up, new THREE.Vector3().crossVectors(forward, up));
  const minusZ = new THREE.Vector3(0, 0, -1);
  const plusY = new THREE.Vector3(0, 1, 0);
  const to = new THREE.Matrix4().makeBasis(minusZ, plusY, new THREE.Vector3().crossVectors(minusZ, plusY));
  scene.quaternion.setFromRotationMatrix(to.multiply(from.transpose()));
  const holder = new THREE.Group();
  holder.add(scene);
  holder.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  scene.scale.multiplyScalar(LENGTH[id] / Math.max(size.x, size.y, size.z));
  holder.updateMatrixWorld(true);
  return holder;
}

// The first-person / dropped version: centred on x, top edge at y = 0 (the
// sight line), most of it ahead of the origin (where the hand is); muzzle
// position recorded.
function forView(template, id) {
  const object = template.clone(true);
  const holder = new THREE.Group();
  holder.add(object);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const length = box.max.z - box.min.z;
  object.position.sub(new THREE.Vector3(
    (box.min.x + box.max.x) / 2,
    id === "grenade" || id === "knife" ? (box.min.y + box.max.y) / 2 : box.max.y,
    box.max.z - length * 0.25,
  ));
  holder.userData.muzzle = new THREE.Vector3(0, -(box.max.y - box.min.y) * 0.25, -length * 0.75);
  holder.userData.height = box.max.y - box.min.y;
  return holder;
}

// Pose a character with one of its clips (a temporary mixer).
function pose(gltf, clipName, time) {
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations.find(a => a.name === clipName);
  if (clip) {
    mixer.clipAction(clip).play();
    mixer.setTime(time);
  }
  gltf.scene.updateMatrixWorld(true);
  return () => mixer.stopAllAction();
}

// A character template: the scene to clone, its clips, and the scale that
// makes it BODY_HEIGHT tall standing in its Idle pose.
function prepareCharacter(gltf, weapons) {
  const done = pose(gltf, "Idle", 0);
  const box = new THREE.Box3();
  gltf.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.computeBoundingBox();
    box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
    o.frustumCulled = false; // skinned bounds don't follow the animation
  });
  done();
  return {
    scene: gltf.scene,
    clips: gltf.animations,
    clipNames: new Set(gltf.animations.map(a => a.name)),
    scale: BODY_HEIGHT / (box.max.y - box.min.y),
    weapons,
  };
}

// A fresh copy of a weapon for one use (shares geometry and materials).
export const cloneProp = (template) => {
  const c = template.clone(true);
  c.userData = { ...template.userData };
  return c;
};

// One animated character instance: its own skeleton, mixer, weapons in hand
// and (so it can flash red when hit) its own copies of the materials.
export function createCharacterInstance(template) {
  const scene = cloneSkinned(template.scene);
  const materials = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const copies = list.map((m) => {
      if (!materials.has(m)) {
        const c = m.clone();
        if (c.emissive) c.emissive.set(0xff0000);
        c.emissiveIntensity = 0;
        materials.set(m, c);
      }
      return materials.get(m);
    });
    o.material = Array.isArray(o.material) ? copies : copies[0];
  });

  const root = new THREE.Group();
  scene.scale.setScalar(template.scale);
  // The models face +z; the game's 0 yaw faces -z.
  scene.rotation.y = Math.PI;
  root.add(scene);

  // One copy of every weapon, in the character's frame (barrel toward -z,
  // like the game's facing); only the one being held is shown.
  const hand = scene.getObjectByName(HAND_BONE);
  const inHand = {};
  for (const id of WEAPON_IDS) {
    const w = template.weapons[id].children[0].clone(true);
    const holder = new THREE.Group();
    holder.add(w);
    holder.visible = false;
    root.add(holder);
    inHand[id] = holder;
  }
  const handPos = new THREE.Vector3();
  const bones = {
    chest: scene.getObjectByName("Chest") ?? scene.getObjectByName("Torso"),
    body: scene.getObjectByName("Body"),
    legs: ["L", "R"].map(side => ({
      upper: scene.getObjectByName(`UpperLeg${side}`),
      lower: scene.getObjectByName(`LowerLeg${side}`),
      foot: scene.getObjectByName(`Foot${side}`),
    })).filter(l => l.upper && l.lower && l.foot),
  };
  const crouchRig = bones.body && bones.legs.length === 2 ? createCrouch(root, bones) : null;

  const mixer = new THREE.AnimationMixer(scene);
  const actions = new Map(template.clips.map(c => [c.name, mixer.clipAction(c)]));
  return {
    root,
    mixer,
    actions,
    clipNames: template.clipNames,
    showGun(weaponId) {
      for (const [id, node] of Object.entries(inHand)) node.visible = id === weaponId;
    },
    // After the mixer has posed the skeleton for this frame: crouch (0..1
    // bends the legs), lean the chest toward the aim (`pitch`, up
    // positive), and put the held weapon in the hand — or at the chest when
    // the clip's arms swing (`followHand` false) — pointing along the aim.
    finishPose({ pitch = 0, crouch = 0, followHand = true }) {
      crouchRig?.apply(crouch);
      bones.chest?.rotateX(-pitch * AIM_LEAN);
      root.updateMatrixWorld(true);
      if (followHand) root.worldToLocal(hand.getWorldPosition(handPos)).add(GRIP_OFFSET);
      else root.worldToLocal(bones.chest.getWorldPosition(handPos)).add(CHEST_HOLD);
      for (const node of Object.values(inHand)) {
        if (!node.visible) continue;
        node.position.copy(handPos);
        node.rotation.set(pitch, 0, 0);
      }
    },
    setFlash(on) {
      for (const m of materials.values()) m.emissiveIntensity = on ? 0.7 : 0;
    },
    dispose() {
      mixer.stopAllAction();
      for (const m of materials.values()) m.dispose();
    },
  };
}

// Crouch for a rig without a crouch clip. Each frame, after the clip has
// posed the skeleton: lower the Body bone, then for each leg solve two-bone
// IK — thigh and shin keep their lengths, the knee bends forward (the way
// the character faces), the shin ends at the foot the clip placed. Bones
// the clip doesn't animate are put back before being changed again, so
// nothing accumulates frame to frame.
function createCrouch(root, { body, legs }) {
  const touched = [body, ...legs.flatMap(l => [l.upper, l.lower])];
  const saved = new Map();   // bone → { pos, quat } as the clip left it
  const written = new Map(); // bone → { pos, quat } as we left it
  const v = () => new THREE.Vector3();
  const [H, K, F, P, fwd, dir, bend, knee, cur, want] = Array.from({ length: 10 }, v);
  const q = new THREE.Quaternion();
  const pq = new THREE.Quaternion();
  const wq = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);

  // Turn `bone` (world space) so its local +y axis points along `to`.
  const aim = (bone, to) => {
    bone.getWorldQuaternion(wq);
    cur.copy(Y).applyQuaternion(wq).normalize();
    q.setFromUnitVectors(cur, to);
    bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
    bone.updateMatrixWorld(true);
  };

  return {
    apply(amount) {
      // Restore what the clip didn't overwrite since last frame.
      for (const b of touched) {
        const w = written.get(b);
        if (w && b.position.equals(w.pos) && b.quaternion.equals(w.quat)) {
          const s = saved.get(b);
          b.position.copy(s.pos);
          b.quaternion.copy(s.quat);
        }
        saved.set(b, { pos: b.position.clone(), quat: b.quaternion.clone() });
      }
      written.clear();
      if (!amount) return;

      root.updateMatrixWorld(true);
      // Leg lengths and foot targets, before the body moves.
      const lengths = legs.map(l => [
        l.upper.getWorldPosition(H).distanceTo(l.lower.getWorldPosition(K)),
        K.distanceTo(l.foot.getWorldPosition(F)),
      ]);
      const feet = legs.map(l => l.foot.getWorldPosition(v()));

      body.getWorldPosition(P).y -= CROUCH_DROP * amount;
      body.position.copy(body.parent.worldToLocal(P));
      body.updateMatrixWorld(true);

      fwd.set(0, 0, -1).applyQuaternion(root.getWorldQuaternion(wq)).setY(0).normalize();
      legs.forEach((l, i) => {
        const [a, b] = lengths[i];
        l.upper.getWorldPosition(H);
        F.copy(feet[i]);
        dir.subVectors(F, H);
        const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, dir.length()));
        dir.normalize();
        const cosA = (a * a + d * d - b * b) / (2 * a * d);
        const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
        bend.copy(fwd).addScaledVector(dir, -fwd.dot(dir)).normalize();
        knee.copy(H).addScaledVector(dir, a * cosA).addScaledVector(bend, a * sinA);
        aim(l.upper, want.subVectors(knee, H).normalize());
        aim(l.lower, want.subVectors(F, l.lower.getWorldPosition(K)).normalize());
      });
      for (const b of touched) written.set(b, { pos: b.position.clone(), quat: b.quaternion.clone() });
    },
  };
}
