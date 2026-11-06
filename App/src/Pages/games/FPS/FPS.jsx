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
import { DIFFICULTIES } from "./engine/ai.js";
import { loadModels } from "./render/models.js";
import { QUALITY_LEVELS, DEFAULT_QUALITY, FPS_LIMITS, DEFAULT_FPS_LIMIT, IDLE_FPS, qualityOf } from "./engine/quality.js";

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

const DEFAULT_SETTINGS = {
  sensitivity: 1, invertY: false, fov: 75, keyTurnSpeed: 2.5,
  quality: DEFAULT_QUALITY, fpsLimit: DEFAULT_FPS_LIMIT, showStats: false,
};

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
  ["R", "reload"], ["1–4 / wheel", "weapons"], ["Q", "last weapon"], ["E", "take gun"], ["Esc", "pause"],
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

// A row of mutually exclusive buttons.
function Segmented({ label, options, value, onChange }) {
  return (
    <div className="text-sm text-slate-300">
      <div className="mb-1">{label}</div>
      <div className="flex gap-1">
        {options.map(([v, text]) => (
          <button key={String(v)} onClick={() => onChange(v)}
            className={`flex-1 px-2 py-1 rounded-md text-xs border capitalize transition-colors ${
              v === value ? "border-indigo-400 bg-indigo-600/30 text-white" : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"}`}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const QUALITY_OPTIONS = QUALITY_LEVELS.map(l => [l, l]);
const FPS_OPTIONS = FPS_LIMITS.map(f => [f, f ? `${f} fps` : "Unlimited"]);

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

// One-shot fade used by the hurt flash and hit markers; each new event
// remounts the element (new React key), which restarts the animation.
const FADE_KEYFRAMES = "@keyframes fps-fade { from { opacity: 1 } to { opacity: 0 } }";
const fade = (ms) => ({ animation: `fps-fade ${ms}ms ease-out forwards` });

function HealthHud({ hp }) {
  const color = hp > 60 ? "bg-emerald-400" : hp > 30 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 w-48 font-mono text-white drop-shadow">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-white/60">HP</span>
        <span className="text-3xl font-bold">{hp}</span>
      </div>
      <div className="h-2 rounded bg-black/40 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-150`} style={{ width: `${hp}%` }} />
      </div>
    </div>
  );
}

// Red edges for a moment whenever the player takes damage.
function HurtFlash() {
  return (
    <div className="pointer-events-none absolute inset-0" style={{
      ...fade(450),
      background: "radial-gradient(ellipse at center, transparent 45%, rgba(220,38,38,0.55) 100%)",
    }} />
  );
}

// An "X" around the crosshair: white for a hit, yellow for a headshot, red for a kill.
function HitMarker({ kind }) {
  const color = kind === "kill" ? "#ef4444" : kind === "head" ? "#facc15" : "#ffffff";
  const arm = (rot) => (
    <div className="absolute left-1/2 top-1/2 w-[2px] h-2.5" style={{
      background: color, transform: `translate(-50%, -50%) rotate(${rot}deg) translateY(-9px)`,
    }} />
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0" style={fade(kind === "kill" ? 500 : 250)}>
      {arm(45)}{arm(135)}{arm(225)}{arm(315)}
    </div>
  );
}

function DeathOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-red-950/40">
      <div className="text-4xl font-bold text-white drop-shadow">You died</div>
    </div>
  );
}

// Top centre: the wave, and either the countdown to the next one or how
// many enemies are left in this one. Big announcements fade in and out.
function WaveHud({ hud }) {
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 text-center font-mono text-white drop-shadow">
      {hud.wave > 0 && <div className="text-sm text-white/70">Wave {hud.wave}</div>}
      {hud.breakLeft != null
        ? <div className="text-lg font-bold">{hud.wave === 0 ? "First wave" : "Next wave"} in {hud.breakLeft}</div>
        : <div className="text-lg font-bold">{hud.enemiesLeft} {hud.enemiesLeft === 1 ? "enemy" : "enemies"} left</div>}
    </div>
  );
}

function Banner({ text }) {
  return (
    <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 text-4xl font-bold text-white drop-shadow-lg" style={fade(2200)}>
      {text}
    </div>
  );
}

// Run results, with the best score on this map.
function GameOver({ result, mapName, onAgain, onQuit }) {
  const rows = [["Wave reached", result.wave], ["Waves cleared", result.waves], ["Kills", result.kills], ["Headshot kills", result.headshots]];
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
      <div className="w-80 max-h-full overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4 text-center">
        <h2 className="text-2xl font-bold text-white">Game over</h2>
        <div className="text-sm text-slate-400">{mapName}</div>
        <div>
          <div className="text-4xl font-bold text-white font-mono">{result.score}</div>
          <div className={`text-xs ${result.isBest ? "text-amber-300" : "text-slate-400"}`}>
            {result.isBest ? "New best!" : `Best: ${result.best}`}
          </div>
        </div>
        <div className="text-sm text-slate-300 space-y-1">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-mono">{v}</span></div>)}
        </div>
        <button onClick={onAgain} className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">Play again</button>
        <button onClick={onQuit} className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200">Quit to menu</button>
      </div>
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

// Graphics quality, frame limit and the performance readout. Some changes
// only take effect later: anti-aliasing is fixed when the game is opened,
// and Low's box figures are picked when a run starts.
function GraphicsSettings({ s, update, antialiasNow }) {
  const aaPending = antialiasNow !== undefined && qualityOf(s.quality).antialias !== antialiasNow;
  return (
    <div className="space-y-3">
      <Segmented label="Graphics" options={QUALITY_OPTIONS} value={s.quality} onChange={v => update("quality", v)} />
      <Segmented label="Frame limit" options={FPS_OPTIONS} value={s.fpsLimit} onChange={v => update("fpsLimit", v)} />
      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input type="checkbox" checked={s.showStats} onChange={e => update("showStats", e.target.checked)} />
        Show performance
      </label>
      {aaPending && <p className="text-[11px] text-amber-300">Anti-aliasing changes the next time the game is opened.</p>}
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
  const [difficulty, setDifficulty] = usePersistentState("game:fps:difficulty", "normal");
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);     // last run's stats, on the game-over screen
  const [session, setSession] = useState(0);      // bumped by Play / Play again: a fresh run
  const [best, setBest] = usePersistentState("game:fps:best", {}); // map id → { score, wave, kills }
  // Character/weapon models: undefined while loading, null if they failed
  // (the game then uses its box figures), the loaded set otherwise.
  const [models, setModels] = useState(undefined);

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
  const quality = settingsRef.current.quality;

  // Run over: record the best score for this map, show the results and give
  // the mouse back so the buttons can be clicked. Read through a ref by the
  // game, so it always sees the current map and best scores.
  const gameOverRef = useRef(null);
  gameOverRef.current = (stats) => {
    const prev = best[mapId];
    const isBest = !prev || stats.score > prev.score;
    setResult({ ...stats, isBest, best: isBest ? stats.score : prev.score });
    if (isBest) setBest(b => ({ ...b, [mapId]: { score: stats.score, wave: stats.wave, kills: stats.kills } }));
    setPhase("over");
    inputRef.current?.unlock();
  };

  const inGame = phase !== "menu";

  // Start fetching the models as soon as the game is opened (they're only
  // ever downloaded here, never by the rest of the site).
  useEffect(() => {
    if (touchOnly) return;
    let live = true;
    loadModels().then(m => { if (live) setModels(m); });
    return () => { live = false; };
  }, [touchOnly]);

  // Renderer + input + loop: created once per mount, survive map changes.
  useEffect(() => {
    if (touchOnly) return;
    let view;
    try {
      view = createRenderer(mountRef.current, { quality: settingsRef.current.quality });
    } catch {
      setError("webgl");
      return;
    }
    viewRef.current = view;

    const input = createInput(mountRef.current, {
      onLockChange: (locked) => {
        if (locked) setLockFailed(false);
        setPhase(p => (p === "menu" || p === "over" ? p : locked ? "playing" : "paused"));
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
      // Menus and the pause screen don't need the full frame rate.
      maxFps: () => (pausedRef.current ? IDLE_FPS : settingsRef.current.fpsLimit),
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
          const fps = Math.round(frames * 1000 / (now - lastReport));
          let text = `${fps} fps`;
          if (settingsRef.current.showStats) {
            const st = view.stats();
            text += `\n${(1000 / Math.max(1, fps)).toFixed(1)} ms · ${st.calls} draws\n${(st.triangles / 1000).toFixed(1)}k tris · ${st.width}×${st.height}`;
          }
          if (fpsRef.current) fpsRef.current.textContent = text;
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
    const mapScene = buildMapScene(view.scene, map, buildNavGraph(map), quality);
    mapSceneRef.current = mapScene;
    return () => {
      mapSceneRef.current = null;
      mapScene.dispose();
    };
  }, [mapId, quality, touchOnly, error]);

  // Resolution and view distance follow the graphics setting immediately.
  useEffect(() => {
    viewRef.current?.setQuality(quality);
  }, [quality]);

  // What the loop drives: an orbiting preview in the menu, the game otherwise.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const map = getMap(mapId);
    const world = inGame
      ? createGame({
        map, view, primary, difficulty, models: models ?? null, input: inputRef.current,
        getSettings: () => settingsRef.current, isPaused: () => pausedRef.current,
        onGameOver: (stats) => gameOverRef.current(stats),
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
  }, [mapId, inGame, primary, difficulty, session, models, touchOnly, error]);

  useEffect(() => {
    mapSceneRef.current?.setDebug(showDebug);
  }, [showDebug, mapId]);

  const play = () => {
    setLockFailed(false);
    setResult(null);
    setSession(n => n + 1);
    setPhase("paused");          // becomes "playing" once the lock is granted
    inputRef.current?.lock();
  };
  const resume = () => {
    setLockFailed(false);
    inputRef.current?.lock();
  };
  const quit = () => {
    inputRef.current?.unlock();
    setResult(null);
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
      <style>{FADE_KEYFRAMES}</style>
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute top-4 right-4 text-right font-mono text-xs text-slate-300">
        <div ref={fpsRef} className="whitespace-pre-line">– fps</div>
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

      {phase === "playing" && hud && !hud.ads && !hud.dead && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/90 ring-1 ring-black/60" />
        </div>
      )}

      {inGame && hud && hud.marker.n > 0 && <HitMarker key={hud.marker.n} kind={hud.marker.kind} />}
      {inGame && hud && hud.hurt > 0 && <HurtFlash key={hud.hurt} />}
      {inGame && hud && !hud.dead && <WeaponHud hud={hud} />}
      {inGame && hud && !hud.dead && <HealthHud hp={hud.hp} />}
      {inGame && hud && (
        <div className="pointer-events-none absolute top-4 left-4 font-mono text-sm text-white/80 drop-shadow">
          <div>Score <span className="text-white font-bold">{hud.score}</span></div>
          <div>Kills <span className="text-white font-bold">{hud.kills}</span></div>
        </div>
      )}
      {inGame && hud && !hud.dead && <WaveHud hud={hud} />}
      {inGame && hud && hud.banner.n > 0 && <Banner key={hud.banner.n} text={hud.banner.text} />}
      {inGame && hud?.message && (
        <div key={hud.message.n} className="pointer-events-none absolute left-1/2 bottom-28 -translate-x-1/2 font-mono text-sm text-emerald-300 drop-shadow" style={fade(1500)}>
          {hud.message.text}
        </div>
      )}
      {phase === "playing" && hud?.prompt && (
        <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-black/50 px-3 py-1 font-mono text-sm text-white">
          {hud.prompt}
        </div>
      )}
      {phase !== "over" && hud?.dead && <DeathOverlay />}
      {phase === "over" && result && (
        <GameOver result={result} mapName={current.name} onAgain={play} onQuit={quit} />
      )}

      {phase === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
          <div className="w-80 max-h-full overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4">
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
            <GraphicsSettings s={s} update={updateSetting} antialiasNow={viewRef.current?.antialias} />
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
            <span className="text-xs text-slate-400 ml-3 mr-1">Bots</span>
            {DIFFICULTIES.map(id => (
              <button key={id} onClick={() => setDifficulty(id)}
                className={`px-3 py-1 rounded-md text-xs border capitalize transition-colors ${
                  id === difficulty ? "border-indigo-400 bg-indigo-600/30 text-white" : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"}`}>
                {id}
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-3 mr-1">Graphics</span>
            {QUALITY_LEVELS.map(id => (
              <button key={id} onClick={() => updateSetting("quality", id)}
                className={`px-3 py-1 rounded-md text-xs border capitalize transition-colors ${
                  id === quality ? "border-indigo-400 bg-indigo-600/30 text-white" : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"}`}>
                {id}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} />
              Show spawns &amp; nav grid
            </label>
            {best[current.id] && (
              <span className="text-xs text-slate-400 font-mono">
                Best {best[current.id].score} · wave {best[current.id].wave}
              </span>
            )}
            <button onClick={play} disabled={models === undefined}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold">
              {models === undefined ? "Loading models…" : `Play ${current.name}`}
            </button>
          </div>
          {/* Required attribution for the CC BY model (details in public/fps/models/CREDITS.md). */}
          <div className="mt-2 text-[10px] text-slate-500">
            Models: &ldquo;Soldier&rdquo; by Quaternius (CC BY 3.0, modified); SWAT and weapons by Quaternius and CreativeTrio (CC0) — via Poly Pizza.
          </div>
        </div>
      )}
    </div>
  );
}
