import { useEffect, useRef, useState } from "react";
import { createLoop } from "./engine/loop.js";
import { createRenderer } from "./render/renderer.js";
import { buildTestScene } from "./render/testScene.js";

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

export default function FPS() {
  const [touchOnly] = useState(isTouchOnly);
  const [error, setError] = useState(null);
  const mountRef = useRef(null);
  const fpsRef = useRef(null);

  useEffect(() => {
    if (touchOnly) return;
    let view;
    try {
      view = createRenderer(mountRef.current);
    } catch {
      setError("webgl");
      return;
    }
    const world = buildTestScene(view.scene);

    let frames = 0;
    let lastReport = performance.now();
    const loop = createLoop({
      update: (dt) => world.update(dt),
      render: () => {
        world.placeCamera(view.camera);
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
      view.dispose();
    };
  }, [touchOnly]);

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute top-4 right-4 text-right font-mono text-xs text-slate-300">
        <div ref={fpsRef}>– fps</div>
        <div className="text-slate-500">FPS-1 scaffold · maps and controls coming next</div>
      </div>
    </div>
  );
}
