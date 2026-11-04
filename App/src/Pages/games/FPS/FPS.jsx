import { useEffect, useRef, useState } from "react";
import { usePersistentState } from "../../../Utils/usePersistentState";
import { createLoop } from "./engine/loop.js";
import { buildNavGraph } from "./engine/nav.js";
import { MAPS, getMap } from "./maps/index.js";
import { createRenderer } from "./render/renderer.js";
import { buildMapScene } from "./render/mapScene.js";

// FPS game shell. This module (and three.js with it) is lazy-loaded from
// Games.jsx, so nothing here is downloaded until the game is opened.
//
// The game loop runs outside React: React only owns the mount point and the
// overlays. Per-frame values (like the fps readout) are written straight to
// DOM refs at a throttled rate instead of going through state.

// Pointer lock and WASD need a mouse and keyboard; a device whose only
// pointer is coarse (phones, most tablets) can't play.
function isTouchOnly() {
  return typeof window.matchMedia === "function" && !window.matchMedia("(any-pointer: fine)").matches;
}

function Notice({ title, children }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md text-center bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 text-sm">{children}</p>
      </div>
    </div>
  );
}

const LEGEND = [
  ["bg-green-500", "player spawn"], ["bg-red-500", "enemy spawn (hidden)"],
  ["bg-blue-500", "team A"], ["bg-orange-500", "team B"],
  ["bg-cyan-400", "walkable"], ["bg-yellow-400", "cover"], ["bg-slate-500", "unreachable"],
];

// Slow orbit around the map while there's no player to look through (FPS-3
// replaces this with the first-person camera).
function createOrbit(map) {
  const size = Math.max(...map.size);
  let angle = 0.6;
  return {
    update(dt) { angle += dt * 0.08; },
    placeCamera(camera) {
      camera.position.set(Math.cos(angle) * size * 0.62, size * 0.38, Math.sin(angle) * size * 0.62);
      camera.lookAt(0, 0, 0);
    },
  };
}

export default function FPS() {
  const [touchOnly] = useState(isTouchOnly);
  const [error, setError] = useState(null);
  const [mapId, setMapId] = usePersistentState("game:fps:map", MAPS[0].id);
  const [showDebug, setShowDebug] = useState(false);
  const mountRef = useRef(null);
  const fpsRef = useRef(null);
  const viewRef = useRef(null);      // renderer/scene/camera for the session
  const worldRef = useRef(null);     // what the loop is currently driving
  const mapSceneRef = useRef(null);

  // Renderer + loop: created once per mount, survive map changes.
  useEffect(() => {
    if (touchOnly) return;
    let view;
    try {
      view = createRenderer(mountRef.current);
    } catch {
      setError("webgl");
      return;
    }
    viewRef.current = view;

    let frames = 0;
    let lastReport = performance.now();
    const loop = createLoop({
      update: (dt) => worldRef.current?.update(dt),
      render: () => {
        worldRef.current?.placeCamera(view.camera);
        view.render();
        frames++;
        const now = performance.now();
        if (now - lastReport >= 500) {
          if (fpsRef.current) fpsRef.current.textContent = `${Math.round(frames * 1000 / (now - lastReport))} fps`;
          frames = 0;
          lastReport = now;
        }
      },
    });
    loop.start();

    return () => {
      loop.stop();
      viewRef.current = null;
      view.dispose();
    };
  }, [touchOnly]);

  // The map: rebuilt (and the old one disposed) whenever the selection changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const map = getMap(mapId);
    const mapScene = buildMapScene(view.scene, map, buildNavGraph(map));
    mapSceneRef.current = mapScene;
    worldRef.current = createOrbit(map);
    return () => {
      worldRef.current = null;
      mapSceneRef.current = null;
      mapScene.dispose();
    };
  }, [mapId, touchOnly, error]);

  useEffect(() => {
    mapSceneRef.current?.setDebug(showDebug);
  }, [showDebug, mapId]);

  if (touchOnly) {
    return (
      <Notice title="Desktop required">
        This game needs a mouse and keyboard. Open it on a desktop or laptop.
      </Notice>
    );
  }
  if (error === "webgl") {
    return (
      <Notice title="WebGL unavailable">
        Your browser couldn&apos;t start WebGL. Enable hardware acceleration or try another browser.
      </Notice>
    );
  }

  const current = getMap(mapId);
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute top-4 right-4 text-right font-mono text-xs text-slate-300">
        <div ref={fpsRef}>– fps</div>
        <div className="text-slate-500">map preview · controls coming next</div>
      </div>

      {showDebug && (
        <div className="pointer-events-none absolute top-16 left-4 rounded-lg bg-slate-900/80 border border-slate-700 p-3 text-xs text-slate-300 space-y-1">
          {LEGEND.map(([cls, label]) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-sm ${cls}`} />{label}
            </div>
          ))}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(46rem,calc(100%-2rem))] rounded-xl bg-slate-900/85 border border-slate-700 p-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {MAPS.map(m => (
            <button
              key={m.id}
              onClick={() => setMapId(m.id)}
              className={`flex-1 min-w-[9rem] text-left rounded-lg px-3 py-2 border transition-colors ${
                m.id === current.id ? "border-indigo-400 bg-indigo-600/30 text-white" : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"}`}
            >
              <div className="font-semibold text-sm">{m.name}</div>
              <div className="text-xs text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} />
          Show spawns &amp; nav grid
        </label>
      </div>
    </div>
  );
}
