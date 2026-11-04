// ─── Map → three.js scene ───────────────────────────────────────────────────
// Turns map data into meshes. Boxes are drawn as one InstancedMesh per
// material (a handful of draw calls for the whole map, however many boxes),
// plus one merged line mesh outlining every box so edges stay readable
// without real-time shadows. Also builds an optional debug overlay showing
// spawns and the nav grid.
import * as THREE from "three";
import { disposeObject } from "./renderer.js";

const unitBox = () => new THREE.BoxGeometry(1, 1, 1);

// Small procedural tile texture so the floor gives a sense of speed and
// distance (no image files to ship).
function floorTexture(color) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const base = new THREE.Color(color);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, size, size);
  g.fillStyle = `#${base.clone().multiplyScalar(0.82).getHexString()}`;
  g.fillRect(0, 0, size / 2, size / 2);
  g.fillRect(size / 2, size / 2, size / 2, size / 2);
  g.strokeStyle = `#${base.clone().multiplyScalar(0.6).getHexString()}`;
  g.lineWidth = 2;
  g.strokeRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Deterministic per-box brightness jitter, so repeated crates aren't identical.
const jitter = (i) => 0.92 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.16;

export function buildMapScene(scene, map, nav) {
  const root = new THREE.Group();
  const { theme } = map;
  const [w, d] = map.size;

  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.sky, theme.fog[0], theme.fog[1]);

  root.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2a35, 1.3));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
  sun.position.set(w * 0.3, 40, d * 0.2);
  root.add(sun);

  const tex = floorTexture(theme.floor);
  tex.repeat.set(w / 4, d / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  // One InstancedMesh per material.
  const byMat = new Map();
  map.boxes.forEach((b, i) => {
    if (!byMat.has(b.mat)) byMat.set(b.mat, []);
    byMat.get(b.mat).push([b, i]);
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  for (const [mat, list] of byMat) {
    const mesh = new THREE.InstancedMesh(unitBox(), new THREE.MeshStandardMaterial({ roughness: 0.85 }), list.length);
    list.forEach(([b, i], k) => {
      pos.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      scale.set(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
      mesh.setMatrixAt(k, m4.compose(pos, q, scale));
      mesh.setColorAt(k, color.set(theme.mats[mat]).multiplyScalar(jitter(i)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    root.add(mesh);
  }

  root.add(buildOutlines(map.boxes));

  const debug = buildDebugOverlay(map, nav);
  debug.visible = false;
  root.add(debug);

  scene.add(root);
  return {
    setDebug(on) { debug.visible = on; },
    dispose() {
      scene.remove(root);
      disposeObject(root);
      scene.background = null;
      scene.fog = null;
    },
  };
}

// All 12 edges of every box in a single LineSegments (one draw call).
function buildOutlines(boxes) {
  const pts = [];
  for (const { min: a, max: b } of boxes) {
    const c = [
      [a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]],
      [a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]],
    ];
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      pts.push(...c[i], ...c[j]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
}

const SPAWN_COLORS = { player: 0x22c55e, enemy: 0xef4444, a: 0x3b82f6, b: 0xf97316 };

function buildDebugOverlay(map, nav) {
  const group = new THREE.Group();

  // Nav nodes: cyan = walkable, yellow = cover, grey = unreachable pockets.
  const pts = [];
  const cols = [];
  const c = new THREE.Color();
  for (const n of nav.nodes) {
    pts.push(n.x, n.y + 0.05, n.z);
    c.set(n.component !== nav.mainComponent ? 0x64748b : n.cover ? 0xfacc15 : 0x22d3ee);
    cols.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  group.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.18, vertexColors: true, fog: false })));

  // Spawns: a body-sized pillar with a nose pointing along its yaw.
  const pillar = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 12);
  const nose = new THREE.ConeGeometry(0.2, 0.6, 8);
  const add = (s, kind) => {
    const mat = new THREE.MeshBasicMaterial({ color: SPAWN_COLORS[kind], transparent: true, opacity: 0.75 });
    const body = new THREE.Mesh(pillar, mat);
    body.position.set(s.pos[0], s.pos[1] + 0.9, s.pos[2]);
    group.add(body);
    const tip = new THREE.Mesh(nose, mat);
    const yaw = s.yaw ?? 0;
    tip.position.set(s.pos[0] - Math.sin(yaw) * 0.7, s.pos[1] + 1.5, s.pos[2] - Math.cos(yaw) * 0.7);
    tip.rotation.set(-Math.PI / 2, 0, 0);
    tip.rotation.y = yaw;
    tip.rotation.order = "YXZ";
    group.add(tip);
  };
  map.playerSpawns.forEach(s => add(s, "player"));
  map.enemySpawns.forEach(s => add(s, "enemy"));
  map.teamSpawns.a.forEach(s => add(s, "a"));
  map.teamSpawns.b.forEach(s => add(s, "b"));
  return group;
}
