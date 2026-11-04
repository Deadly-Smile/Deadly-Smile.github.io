// ─── Placeholder scene (FPS-1) ──────────────────────────────────────────────
// Something to look at while the scaffold is the whole game: a floor, a few
// crates and a slowly orbiting camera. Replaced by real maps in FPS-2.
import * as THREE from "three";

export function buildTestScene(scene) {
  scene.background = new THREE.Color(0x0f172a);
  scene.fog = new THREE.Fog(0x0f172a, 30, 90);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1e293b, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(10, 20, 8);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x334155 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.GridHelper(60, 30, 0x475569, 0x1e293b));

  const crate = new THREE.BoxGeometry(1, 1, 1);
  const colors = [0xb45309, 0x64748b, 0x0e7490];
  const boxes = [
    [-6, 1, -4, 2, 2, 2], [5, 0.75, -6, 3, 1.5, 1.5], [0, 1.5, 8, 8, 3, 1],
    [-10, 2, 6, 1, 4, 6], [9, 0.5, 4, 1, 1, 1], [3, 1, -1, 1.2, 2, 1.2],
  ];
  boxes.forEach(([x, y, z, w, h, d], i) => {
    const mesh = new THREE.Mesh(crate, new THREE.MeshStandardMaterial({ color: colors[i % colors.length] }));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    scene.add(mesh);
  });

  let angle = 0;
  return {
    update(dt) { angle += dt * 0.15; },
    placeCamera(camera) {
      camera.position.set(Math.cos(angle) * 18, 7, Math.sin(angle) * 18);
      camera.lookAt(0, 1, 0);
    },
  };
}
