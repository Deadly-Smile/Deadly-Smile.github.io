// ─── WebGL renderer lifecycle ───────────────────────────────────────────────
// Owns the three.js renderer, scene and camera for one game session, plus a
// second "view model" scene for the first-person weapon. That one is drawn
// after clearing depth, with its own camera, so the gun never clips into a
// wall and doesn't stretch when the world FOV changes.
// The Games page remounts the game every time it's opened, and browsers only
// allow a handful of live WebGL contexts per page, so `dispose()` has to
// release everything: GPU resources, the context itself, and the canvas.
import * as THREE from "three";
import { qualityOf, pixelRatio } from "../engine/quality.js";

// Throws if WebGL is unavailable (three's constructor fails to get a context);
// the caller shows a message instead of the game. `quality` (engine/quality.js)
// fixes anti-aliasing for the context's lifetime; setQuality() changes the
// rest on the fly.
export function createRenderer(container, { quality } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: qualityOf(quality).antialias, powerPreference: "high-performance" });
  renderer.setPixelRatio(pixelRatio(quality, window.devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Counted over both passes of a frame (see render()), for the stats readout.
  renderer.info.autoReset = false;
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, qualityOf(quality).viewDistance);
  const vmScene = new THREE.Scene();
  const vmCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  vmScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x303040, 1.6));
  const vmSun = new THREE.DirectionalLight(0xffffff, 1.4);
  vmSun.position.set(0.5, 1, 0.6);
  vmScene.add(vmSun);

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = vmCamera.aspect = w / h;
    camera.updateProjectionMatrix();
    vmCamera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  return {
    renderer, scene, camera, vmScene, vmCamera,
    antialias: qualityOf(quality).antialias,
    setQuality(level) {
      const ratio = pixelRatio(level, window.devicePixelRatio);
      if (ratio !== renderer.getPixelRatio()) {
        renderer.setPixelRatio(ratio);
        resize();
      }
      const far = qualityOf(level).viewDistance;
      if (camera.far !== far) {
        camera.far = far;
        camera.updateProjectionMatrix();
      }
    },
    // Draw calls and triangles in the last frame, and the resolution drawn.
    stats() {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: size.x, height: size.y };
    },
    render() {
      renderer.info.reset();
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(vmScene, vmCamera);
    },
    dispose() {
      observer.disconnect();
      disposeObject(scene);
      disposeObject(vmScene);
      scene.clear();
      vmScene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

// Frees the GPU-side buffers/textures/programs of everything under `root`.
// three.js never does this automatically when objects are dropped.
export function disposeObject(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of materials) {
      for (const value of Object.values(m)) {
        if (value?.isTexture) value.dispose();
      }
      m.dispose();
    }
  });
}
