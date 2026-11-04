import { useEffect, useRef, useState } from "react";
import { usePersistentState } from "../../../Utils/usePersistentState";
import { createLoop } from "./engine/loop.js";
import { buildNavGraph } from "./engine/nav.js";
import { MAPS, getMap } from "./maps/index.js";
import { createRenderer } from "./render/renderer.js";
import { buildMapScene } from "./render/mapScene.js";
import { createInput } from "./input.js";
import { createGame } from "./game.js";
import { WEAPONS, PRIMARIES, DEFAULT_PRIMARY } from "./engine/weapons.js";

// FPS game shell. This module (and three.js with it) is lazy-loaded from
// Games.jsx, so nothing here is downloaded until the game is opened.
//
// The game loop runs outside React: React only owns the mount point and the
// overlays. Per-frame values (like the fps readout) are written straight to
// DOM refs at a throttled rate instead of going through state.
//
// Phases: "menu" (map picker, orbiting preview) → "paused" ⇄ "playing".
// Playing means the pointer is locked; losing the lock (Esc, alt-tab) pauses.

// Pointer lock and WASD need a mouse and keyboard; a device whose only
// pointer is coarse (phones, most tablets) can't play.
function isTouchOnly() {
  return typeof window.matchMedia === "function" && !window.matchMedia("(any-pointer: fine)").matches;
}

const DEFAULT_SETTINGS = { sensitivity: 1, invertY: false, fov: 75, keyTurnSpeed: 2.5 };

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

const CONTROLS = [
  ["W A S D", "move"], ["Mouse / ← → ↑ ↓", "look"], ["Shift", "sprint"],
  ["Space", "jump"], ["C", "crouch"], ["Left click", "fire"], ["Right click", "aim"],
  ["R", "reload"], ["1–4 / wheel", "weapons"], ["Q", "last weapon"], ["Esc", "pause"],
];

// How often the React HUD is refreshed from the game (it only re-renders
// when something it shows actually changed).
const HUD_INTERVAL_MS = 100;

// Slow orbit around the map while in the menu.
function createOrbit(map, camera) {
  const size = Math.max(...map.size);
  let angle = 0.6;
  return {
    update(dt) { angle += dt * 0.08; },
    render() {
      camera.position.set(Math.cos(angle) * size * 0.62, size * 0.38, Math.sin(angle) * size * 0.62);
      camera.lookAt(0, 0, 0);
    },
  };
}

function Slider({ label, value, min, max, step, onChange, format = (v) => v }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="flex justify-between mb-1"><span>{label}</span><span className="font-mono text-slate-400">{format(value)}</span></div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} />
    </label>
  );
}

// Black mask with a round window and fine crosshair: the sniper scope.
function ScopeOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0"
      style={{ background: "radial-gradient(circle at center, transparent 0, transparent 34vmin, #000 34.3vmin)" }}>
      <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-black/80" />
      <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-black/80" />
    </div>
  );
}

function WeaponHud({ hud }) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 text-right font-mono text-white drop-shadow">
      <div className="flex justify-end gap-1 mb-2">
        {hud.slots.map(s => (
          <div key={s.key} className={`px-2 py-0.5 rounded text-[11px] border ${
            s.active ? "border-white/80 bg-white/20" : "border-white/20 bg-black/30 text-white/60"} ${s.empty ? "opacity-40" : ""}`}>
            <span className="text-white/50 mr-1">{s.key}</span>{s.name}{s.count != null && ` ×${s.count}`}
          </div>
        ))}
      </div>
      <div className="text-sm text-white/80">{hud.weapon}</div>
      {hud.kind === "gun" && (
        <div className="text-3xl font-bold leading-tight">
          <span className={hud.mag === 0 ? "text-red-400" : ""}>{hud.mag}</span>
          <span className="text-lg text-white/60"> / {hud.reserve}</span>
        </div>
      )}
      {hud.kind === "throw" && <div className="text-3xl font-bold leading-tight">×{hud.mag}</div>}
      {hud.reloading && <div className="text-xs text-amber-300 animate-pulse">reloading…</div>}
    </div>
  );
}

export default function FPS() {
  const [touchOnly] = useState(isTouchOnly);
  const [error, setError] = useState(null);
  const [mapId, setMapId] = usePersistentState("game:fps:map", MAPS[0].id);
  const [settings, setSettings] = usePersistentState("game:fps:settings", DEFAULT_SETTINGS);
  const [showDebug, setShowDebug] = useState(false);
  const [phase, setPhase] = useState("menu");
  const [lockFailed, setLockFailed] = useState(false);
  const [primary, setPrimary] = usePersistentState("game:fps:primary", DEFAULT_PRIMARY);
  const [hud, setHud] = useState(null);

  const mountRef = useRef(null);
  const fpsRef = useRef(null);
  const viewRef = useRef(null);      // renderer/scene/camera for the session
  const inputRef = useRef(null);
  const worldRef = useRef(null);     // what the loop is currently driving
  const mapSceneRef = useRef(null);
  const pausedRef = useRef(true);
  pausedRef.current = phase !== "playing";
  const settingsRef = useRef(settings);
  settingsRef.current = { ...DEFAULT_SETTINGS, ...settings };

  const inGame = phase !== "menu";

  // Renderer + input + loop: created once per mount, survive map changes.
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

    const input = createInput(mountRef.current, {
      onLockChange: (locked) => {
        if (locked) setLockFailed(false);
        setPhase(p => (p === "menu" ? p : locked ? "playing" : "paused"));
      },
      onLockError: () => setLockFailed(true),
    });
    inputRef.current = input;

    let frames = 0;
    let lastReport = performance.now();
    let lastHud = 0;
    let lastHudJson = "";
    const loop = createLoop({
      update: (dt) => worldRef.current?.update(dt),
      render: (alpha, frameDt) => {
        worldRef.current?.render(alpha, frameDt);
        view.render();
        frames++;
        const now = performance.now();
        if (now - lastHud >= HUD_INTERVAL_MS) {
          lastHud = now;
          const next = worldRef.current?.hud?.() ?? null;
          const json = JSON.stringify(next);
          if (json !== lastHudJson) {
            lastHudJson = json;
            setHud(next);
          }
        }
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
      input.dispose();
      inputRef.current = null;
      viewRef.current = null;
      view.dispose();
    };
  }, [touchOnly]);

  // The map's meshes: rebuilt (and the old ones disposed) when the map changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const map = getMap(mapId);
    const mapScene = buildMapScene(view.scene, map, buildNavGraph(map));
    mapSceneRef.current = mapScene;
    return () => {
      mapSceneRef.current = null;
      mapScene.dispose();
    };
  }, [mapId, touchOnly, error]);

  // What the loop drives: an orbiting preview in the menu, the game otherwise.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const map = getMap(mapId);
    const world = inGame
      ? createGame({
        map, view, primary, input: inputRef.current,
        getSettings: () => settingsRef.current, isPaused: () => pausedRef.current,
      })
      : createOrbit(map, view.camera);
    worldRef.current = world;
    if (!inGame) {
      view.camera.fov = DEFAULT_SETTINGS.fov;
      view.camera.updateProjectionMatrix();
    }
    return () => {
      worldRef.current = null;
      world.dispose?.();
    };
  }, [mapId, inGame, primary, touchOnly, error]);

  useEffect(() => {
    mapSceneRef.current?.setDebug(showDebug);
  }, [showDebug, mapId]);

  const play = () => {
    setLockFailed(false);
    setPhase("paused");          // becomes "playing" once the lock is granted
    inputRef.current?.lock();
  };
  const resume = () => {
    setLockFailed(false);
    inputRef.current?.lock();
  };
  const quit = () => {
    inputRef.current?.unlock();
    setPhase("menu");
  };
  const updateSetting = (key, value) => setSettings(s => ({ ...DEFAULT_SETTINGS, ...s, [key]: value }));

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
  const s = settingsRef.current;
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 select-none">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute top-4 right-4 text-right font-mono text-xs text-slate-300">
        <div ref={fpsRef}>– fps</div>
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

      {inGame && hud?.scoped && <ScopeOverlay />}

      {phase === "playing" && hud && !hud.ads && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/90 ring-1 ring-black/60" />
        </div>
      )}

      {inGame && hud && <WeaponHud hud={hud} />}

      {phase === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
          <div className="w-80 rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4">
            <h2 className="text-xl font-bold text-white text-center">Paused</h2>
            <button onClick={resume} className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              Resume
            </button>
            {lockFailed && (
              <p className="text-xs text-amber-300 text-center">
                The browser needs a moment after Esc before it lets the game take the mouse again. Click Resume again.
              </p>
            )}
            <Slider label="Mouse sensitivity" value={s.sensitivity} min={0.2} max={3} step={0.05}
              onChange={v => updateSetting("sensitivity", v)} format={v => v.toFixed(2)} />
            <Slider label="Field of view" value={s.fov} min={60} max={100} step={1}
              onChange={v => updateSetting("fov", v)} format={v => `${v}°`} />
            <Slider label="Arrow-key turn speed" value={s.keyTurnSpeed} min={0.5} max={6} step={0.1}
              onChange={v => updateSetting("keyTurnSpeed", v)} format={v => `${Math.round(v * 180 / Math.PI)}°/s`} />
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={s.invertY} onChange={e => updateSetting("invertY", e.target.checked)} />
              Invert mouse Y
            </label>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              {CONTROLS.map(([k, v]) => <div key={k} className="flex justify-between"><span className="font-mono">{k}</span><span>{v}</span></div>)}
            </div>
            <button onClick={quit} className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200">
              Quit to menu
            </button>
          </div>
        </div>
      )}

      {phase === "menu" && (
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">Primary</span>
            {PRIMARIES.map(id => (
              <button key={id} onClick={() => setPrimary(id)}
                className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                  id === primary ? "border-indigo-400 bg-indigo-600/30 text-white" : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"}`}>
                {WEAPONS[id].name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} />
              Show spawns &amp; nav grid
            </label>
            <button onClick={play} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              Play {current.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
