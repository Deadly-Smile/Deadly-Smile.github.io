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
// How each weapon is held, in the character's frame (m; +x right, +y up,
// -z ahead). The weapon hangs off a pivot near the right shoulder and swings
// about it with the aim pitch; `grip` is where its grip sits from that pivot
// and `support` how far ahead of the grip the left hand holds it (null:
// one-handed). Both hands are then placed on it with IK, whatever the legs'
// clip is doing with the arms. The rig's arms are short (0.42 m), so
// everything is held close.
const SHOULDER_PIVOT = new THREE.Vector3(0.14, 0.08, -0.05); // from the chest bone
const LONG_GUN = { grip: [-0.08, -0.1, -0.18], support: 0.14 };
const HOLD = {
  rifle: LONG_GUN,
  sniper: { ...LONG_GUN, support: 0.16 },
  shotgun: { ...LONG_GUN, support: 0.16 },
  smg: { ...LONG_GUN, support: 0.1 },
  pistol: { grip: [-0.14, 0, -0.34], support: 0 },
  knife: { grip: [0.04, -0.3, -0.2], support: null },
  grenade: { grip: [0.04, -0.3, -0.2], support: null },
};
// The wrist sits this far behind the grip (the hand reaches forward from it).
const WRIST_BACK = 0.07;
// Elbows point down and outward.
const ELBOW_POLE = { R: new THREE.Vector3(0.5, -1, 0.3), L: new THREE.Vector3(-0.5, -1, 0.3) };
// Weapon kick on a shot: back by this much (m), settling at this rate (1/s).
const KICK = 0.045;
const KICK_SETTLE = 16;
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
  const inHand = {};
  for (const id of WEAPON_IDS) {
    const w = template.weapons[id].children[0].clone(true);
    const holder = new THREE.Group();
    holder.add(w);
    holder.visible = false;
    root.add(holder);
    inHand[id] = holder;
  }
  let held = null;

  const bone = (name) => scene.getObjectByName(name);
  const limb = (upper, lower, end) => ({ upper: bone(upper), lower: bone(lower), end: bone(end) });
  const chest = bone("Chest") ?? bone("Torso");
  const body = bone("Body");
  const legs = [limb("UpperLegL", "LowerLegL", "FootL"), limb("UpperLegR", "LowerLegR", "FootR")];
  const arms = { L: limb("UpperArmL", "LowerArmL", "WristL"), R: limb("UpperArmR", "LowerArmR", "WristR") };
  const complete = (l) => l.upper && l.lower && l.end;
  const canCrouch = body && legs.every(complete);
  const canHold = chest && complete(arms.L) && complete(arms.R);
  const rig = createRig(root, [chest, body, ...legs.flatMap(l => [l.upper, l.lower]),
    ...Object.values(arms).flatMap(l => [l.upper, l.lower, l.end])].filter(Boolean));

  const pivot = new THREE.Vector3();
  const grip = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const target = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const rootQuat = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0);

  const mixer = new THREE.AnimationMixer(scene);
  const actions = new Map(template.clips.map(c => [c.name, mixer.clipAction(c)]));
  return {
    root,
    mixer,
    actions,
    clipNames: template.clipNames,
    showGun(weaponId) {
      held = weaponId && inHand[weaponId] ? weaponId : null;
      for (const [id, node] of Object.entries(inHand)) node.visible = id === held;
    },
    // After the mixer has posed the skeleton for this frame: crouch (0..1
    // bends the legs), lean the chest toward the aim (`pitch`, up positive),
    // shoulder the held weapon pointing along `weaponPitch` (the aim, or
    // lower when carried relaxed), and put the hands on it. `kickAgo` is the
    // time since the last shot (s), for the recoil kick.
    finishPose({ pitch = 0, weaponPitch = pitch, crouch = 0, kickAgo = Infinity }) {
      rig.begin();
      if (crouch && canCrouch) rig.crouch(body, legs, CROUCH_DROP * crouch);
      chest?.rotateX(-pitch * AIM_LEAN);
      root.updateMatrixWorld(true);
      if (!held || !canHold) return;

      const hold = HOLD[held];
      const node = inHand[held];
      root.worldToLocal(chest.getWorldPosition(pivot)).add(SHOULDER_PIVOT);
      fwd.set(0, 0, -1).applyAxisAngle(X, weaponPitch);
      grip.set(...hold.grip).applyAxisAngle(X, weaponPitch).add(pivot)
        .addScaledVector(fwd, -KICK * Math.exp(-kickAgo * KICK_SETTLE));
      node.position.copy(grip);
      node.rotation.set(weaponPitch, 0, 0);

      // Hands: right on the grip, left on the fore-end (or over the right
      // hand for a pistol); wrists turned to point along the barrel.
      root.getWorldQuaternion(rootQuat);
      const reach = (side, local) => {
        const arm = arms[side];
        root.localToWorld(target.copy(local));
        rig.solve(arm, target, pole.copy(ELBOW_POLE[side]).applyQuaternion(rootQuat));
        rig.aim(arm.end, pole.copy(fwd).applyQuaternion(rootQuat));
      };
      reach("R", target.copy(grip).addScaledVector(fwd, -WRIST_BACK));
      if (hold.support !== null) {
        target.copy(grip).addScaledVector(fwd, hold.support - WRIST_BACK);
        target.x -= hold.support ? 0.02 : 0.05;
        target.y -= hold.support ? 0.03 : 0.02;
        reach("L", target);
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

// Procedural adjustments on top of the animation clips: two-bone IK for the
// arms (hands on the weapon) and legs (crouching, for a rig without a
// crouch clip). The mixer only rewrites a bone when its animated value
// changes, so begin() first puts back any bone still holding last frame's
// adjustment — otherwise adjustments would pile up frame after frame.
function createRig(root, bones) {
  const saved = new Map();   // bone → { pos, quat } as the clips left it
  const written = new Map(); // bone → { pos, quat } as we left it
  const v = () => new THREE.Vector3();
  const [A, B, E, P, dir, bend, mid, cur, want, fwd] = Array.from({ length: 10 }, v);
  const q = new THREE.Quaternion();
  const pq = new THREE.Quaternion();
  const wq = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);

  // Turn `bone` (world space) so its local +y axis — the direction these
  // bones point along — faces `to`.
  const aim = (bone, to) => {
    bone.getWorldQuaternion(wq);
    cur.copy(Y).applyQuaternion(wq).normalize();
    q.setFromUnitVectors(cur, to);
    bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
    bone.updateMatrixWorld(true);
    written.set(bone, { pos: bone.position.clone(), quat: bone.quaternion.clone() });
  };

  // The two bone lengths of a limb as currently posed.
  const lengths = ({ upper, lower, end }) => {
    upper.getWorldPosition(A);
    lower.getWorldPosition(B);
    return [A.distanceTo(B), B.distanceTo(end.getWorldPosition(E))];
  };

  // Bend upper/lower so the limb's end reaches `target` (world), keeping
  // both bone lengths, with the middle joint pushed toward `poleDir`.
  const solve = (limb, target, poleDir, [a, b] = lengths(limb)) => {
    const { upper, lower } = limb;
    upper.getWorldPosition(A);
    dir.subVectors(target, A);
    const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, dir.length()));
    dir.normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    bend.copy(poleDir).addScaledVector(dir, -poleDir.dot(dir)).normalize();
    mid.copy(A).addScaledVector(dir, a * cosA).addScaledVector(bend, a * sinA);
    aim(upper, want.subVectors(mid, A).normalize());
    // Toward the (reachable) point along the line to the target.
    P.copy(A).addScaledVector(dir, d);
    aim(lower, want.subVectors(P, lower.getWorldPosition(B)).normalize());
  };

  return {
    aim,
    solve,
    begin() {
      for (const b of bones) {
        const w = written.get(b);
        if (w && b.position.equals(w.pos) && b.quaternion.equals(w.quat)) {
          const s = saved.get(b);
          b.position.copy(s.pos);
          b.quaternion.copy(s.quat);
        }
        saved.set(b, { pos: b.position.clone(), quat: b.quaternion.clone() });
      }
      written.clear();
    },
    // Lower `body` by `drop` (m) and bend each knee forward so the feet stay
    // where the clip put them.
    crouch(body, legs, drop) {
      root.updateMatrixWorld(true);
      // Measured before the body moves: the feet hang off the root, not the
      // shins, so they stay behind when it drops.
      const sizes = legs.map(lengths);
      const feet = legs.map(l => l.end.getWorldPosition(v()));
      body.getWorldPosition(P).y -= drop;
      body.position.copy(body.parent.worldToLocal(P));
      body.updateMatrixWorld(true);
      written.set(body, { pos: body.position.clone(), quat: body.quaternion.clone() });
      fwd.set(0, 0, -1).applyQuaternion(root.getWorldQuaternion(wq)).setY(0).normalize();
      legs.forEach((l, i) => solve(l, feet[i], fwd, sizes[i]));
    },
  };
}
