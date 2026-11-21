// ─── On-screen controls for phones and tablets ──────────────────────────────
// The usual mobile-shooter layout:
//   left thumb   a joystick (follows the thumb, or fixed at its spot) in the
//                left 45% of the screen; pushed to the rim forward, it sprints
//   right thumb  drag anywhere on the right to look; the big Fire button can
//                also turn the view while held, so you can aim and shoot at once
//   buttons      aim (toggle), jump, crouch (toggle), reload around Fire; a
//                small second Fire for three-finger play; the weapon slots;
//                Take when a gun is underfoot; pause, and scores/chat in
//                multiplayer, top right
// Mirrored for left-handed play. Where each control sits and how big it is
// comes from the player's preferences (engine/touchLayout.js), and
// `editing` turns this into the layout editor: drag a control to move it,
// select it to resize it.
//
// Everything goes to touchInput.js. Finger movement updates the joystick's
// DOM directly (no React render per move); React only redraws when the HUD
// (slots, ammo, prompts) or the preferences change.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { stickFrom } from "./engine/touch.js";
import {
  resolveLayout, placeControl, resizeControl, resetLayout, inStickZone, CONTROL_DEFAULTS, SCALE, OPACITY, SIZE_FACTOR,
} from "./engine/touchLayout.js";

// Stops the event reaching the look/joystick zone underneath.
const swallow = (e) => {
  e.preventDefault();
  e.stopPropagation();
};
const at = ({ x, y, size }) => ({ left: x - size / 2, top: y - size / 2, width: size, height: size });

// A round button driven by pointer events (works with several fingers at
// once). `onMove(dx, dy)` gets the finger's movement while it's held.
function Pad({ label, place, active = false, onDown, onUp, onMove, tint = "" }) {
  const last = useRef(null);
  return (
    <button type="button"
      onPointerDown={(e) => {
        swallow(e);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        last.current = [e.clientX, e.clientY];
        onDown?.();
      }}
      onPointerMove={(e) => {
        if (!last.current || !onMove) return;
        onMove(e.clientX - last.current[0], e.clientY - last.current[1]);
        last.current = [e.clientX, e.clientY];
      }}
      onPointerUp={() => { last.current = null; onUp?.(); }}
      onPointerCancel={() => { last.current = null; onUp?.(); }}
      onContextMenu={(e) => e.preventDefault()}
      className={`absolute flex items-center justify-center rounded-full border-2 font-semibold text-white select-none ${
        active ? "bg-indigo-500/70 border-indigo-200" : tint || "bg-black/35 border-white/40 active:bg-white/30"}`}
      style={{ ...at(place), fontSize: place.size > 70 ? 15 : 12, touchAction: "none", WebkitTouchCallout: "none" }}>
      {label}
    </button>
  );
}

// The size of the element `ref` points at, kept up to date. `key` changes
// when the element itself is swapped (the editor draws its own).
function useSize(ref, key) {
  const [size, setSize] = useState([0, 0]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize([el.clientWidth, el.clientHeight]);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, key]);
  return size;
}

export default function TouchControls({ input, hud, multiplayer, prefs, onPause, onChat, editing = false, onPrefs, onDone }) {
  const zoneRef = useRef(null);
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const fingers = useRef(new Map()); // pointerId → { kind: "stick" | "look", x0, y0, x, y }
  const [toggles, setToggles] = useState(() => input.toggles());
  const [w, h] = useSize(zoneRef, editing);
  const lay = resolveLayout(prefs, w, h);
  const stickR = lay.stick.size / 2;
  const dead = !!hud?.dead;

  // Aim and crouch don't carry over to the next life.
  useEffect(() => {
    if (!dead) return;
    input.clearToggles();
    setToggles(input.toggles());
  }, [dead, input]);

  // The joystick at its resting spot, or (floating) under the thumb.
  const placeStick = (centre) => {
    const base = baseRef.current;
    if (!base) return;
    const c = centre ?? [lay.stick.x, lay.stick.y];
    base.style.left = `${c[0] - stickR}px`;
    base.style.top = `${c[1] - stickR}px`;
    base.style.opacity = String(prefs.opacity * (centre ? 1 : 0.6));
    knobRef.current.style.transform = "translate(-50%, -50%)";
  };
  // Back to rest whenever the layout moves it (and on first draw).
  useLayoutEffect(() => {
    if (![...fingers.current.values()].some(f => f.kind === "stick")) placeStick(null);
  });

  const onZoneDown = (e) => {
    if (editing || e.target !== e.currentTarget) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const kind = inStickZone(prefs, x, rect.width) ? "stick" : "look";
    if ([...fingers.current.values()].some(f => f.kind === kind)) return; // one thumb per job
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // A fixed stick is pushed relative to its own centre, wherever the thumb lands.
    const origin = kind === "stick" && prefs.fixedStick ? [rect.left + lay.stick.x, rect.top + lay.stick.y] : [e.clientX, e.clientY];
    fingers.current.set(e.pointerId, { kind, x0: origin[0], y0: origin[1], x: e.clientX, y: e.clientY });
    if (kind === "stick") {
      if (!prefs.fixedStick) placeStick([x, y]);
      else baseRef.current.style.opacity = String(prefs.opacity);
      moveStick(fingers.current.get(e.pointerId), e.clientX, e.clientY);
    }
  };
  const moveStick = (f, x, y) => {
    const s = stickFrom(x - f.x0, y - f.y0, stickR);
    input.setStick(s);
    knobRef.current.style.transform = `translate(calc(-50% + ${s.knob[0]}px), calc(-50% + ${s.knob[1]}px))`;
  };
  const onZoneMove = (e) => {
    const f = fingers.current.get(e.pointerId);
    if (!f) return;
    if (f.kind === "stick") moveStick(f, e.clientX, e.clientY);
    else input.look(e.clientX - f.x, e.clientY - f.y);
    f.x = e.clientX;
    f.y = e.clientY;
  };
  const onZoneUp = (e) => {
    const f = fingers.current.get(e.pointerId);
    if (!f) return;
    fingers.current.delete(e.pointerId);
    if (f.kind === "stick") {
      input.setStick({ x: 0, y: 0 });
      placeStick(null);
    }
  };

  const toggle = (name) => setToggles({ ...toggles, [name]: input.toggle(name) });
  const tap = (name, slot) => {
    input.tap(name, slot);
    setToggles(input.toggles());
  };
  const fire = { onDown: () => input.press("fire"), onUp: () => input.release("fire") };
  const take = hud?.prompt?.replace(/^E — /, "");
  const ready = w > 0 && h > 0;
  const weaponBar = lay.weapons;

  if (editing) return <LayoutEditor lay={lay} w={w} h={h} prefs={prefs} zoneRef={zoneRef} onPrefs={onPrefs} onDone={onDone} />;

  return (
    <div ref={zoneRef} className="absolute inset-0 select-none" style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onPointerDown={onZoneDown} onPointerMove={onZoneMove} onPointerUp={onZoneUp} onPointerCancel={onZoneUp}
      onContextMenu={(e) => e.preventDefault()}>
      {ready && (
        <>
          {/* Joystick */}
          <div ref={baseRef} className="pointer-events-none absolute rounded-full border-2 border-white/40 bg-black/20"
            style={{ width: stickR * 2, height: stickR * 2 }}>
            <div ref={knobRef} className="absolute left-1/2 top-1/2 rounded-full bg-white/50 border border-white/70"
              style={{ width: stickR * 0.85, height: stickR * 0.85 }} />
          </div>

          <div style={{ opacity: prefs.opacity }}>
            <Pad label="FIRE" place={lay.fire} {...fire} onMove={prefs.fireTurns ? (x, y) => input.look(x, y) : undefined}
              tint="bg-red-600/40 border-red-200/70 active:bg-red-500/60" />
            <Pad label="AIM" place={lay.aim} active={toggles.ads} onDown={() => toggle("ads")} />
            <Pad label="R" place={lay.reload} onDown={() => tap("reload")} />
            <Pad label="JUMP" place={lay.jump} onDown={() => tap("jump")} />
            <Pad label="CROUCH" place={lay.crouch} active={toggles.crouch} onDown={() => toggle("crouch")} />
            {prefs.leftFire && <Pad label="FIRE" place={lay.fire2} {...fire} tint="bg-red-600/30 border-red-200/50 active:bg-red-500/50" />}

            {/* Weapon slots */}
            {hud?.slots && (
              <div className="absolute flex gap-1.5 -translate-x-1/2 -translate-y-1/2" style={{ left: weaponBar.x, top: weaponBar.y, height: weaponBar.size }}>
                {hud.slots.map((s, i) => (
                  <button key={s.key} type="button" onPointerDown={(e) => { swallow(e); tap("slot", i); }}
                    className={`px-3 rounded-lg font-mono border whitespace-nowrap ${
                      s.active ? "border-white/80 bg-white/25 text-white" : "border-white/25 bg-black/40 text-white/70"} ${s.empty ? "opacity-40" : ""}`}
                    style={{ touchAction: "none", fontSize: weaponBar.size * 0.33 }}>
                    {s.name}{s.count != null && ` ×${s.count}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Weapon and ammo, just above Fire */}
          {hud && (
            <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-center font-mono text-white drop-shadow whitespace-nowrap"
              style={{ left: lay.fire.x, top: lay.fire.y - lay.fire.size / 2 - 4 }}>
              <div className="text-[11px] text-white/80">{hud.weapon}{hud.reloading && <span className="text-amber-300"> · reloading</span>}</div>
              {hud.kind === "gun" && (
                <div className="text-xl font-bold leading-tight">
                  <span className={hud.mag === 0 ? "text-red-400" : ""}>{hud.mag}</span>
                  <span className="text-sm text-white/60"> / {hud.reserve}</span>
                </div>
              )}
              {hud.kind === "throw" && <div className="text-xl font-bold leading-tight">×{hud.mag}</div>}
            </div>
          )}

          {take && (
            <button type="button" onPointerDown={(e) => { swallow(e); tap("use"); }}
              className="absolute -translate-x-1/2 -translate-y-full px-4 py-2 rounded-lg bg-emerald-600/80 border border-emerald-200/70 text-sm font-semibold text-white"
              style={{ touchAction: "none", left: weaponBar.x, top: weaponBar.y - weaponBar.size / 2 - 8 }}>
              {take[0].toUpperCase() + take.slice(1)}
            </button>
          )}
        </>
      )}

      {/* Top right: pause; scores and chat in multiplayer */}
      <div className="absolute top-2 flex gap-2" style={{ right: "calc(env(safe-area-inset-right, 0px) + 8px)" }}>
        {multiplayer && (
          <>
            <button type="button" onPointerDown={(e) => { swallow(e); onChat("team"); }}
              className="px-3 h-10 rounded-lg bg-black/45 border border-white/30 text-xs text-white" style={{ touchAction: "none" }}>Team</button>
            <button type="button" onPointerDown={(e) => { swallow(e); onChat("all"); }}
              className="px-3 h-10 rounded-lg bg-black/45 border border-white/30 text-xs text-white" style={{ touchAction: "none" }}>Chat</button>
            <button type="button"
              onPointerDown={(e) => { swallow(e); e.currentTarget.setPointerCapture?.(e.pointerId); input.press("scores"); }}
              onPointerUp={() => input.release("scores")} onPointerCancel={() => input.release("scores")}
              className="px-3 h-10 rounded-lg bg-black/45 border border-white/30 text-xs text-white" style={{ touchAction: "none" }}>Scores</button>
          </>
        )}
        <button type="button" aria-label="Pause" onPointerDown={(e) => { swallow(e); onPause(); }}
          className="w-10 h-10 rounded-lg bg-black/45 border border-white/30 text-white text-lg leading-none" style={{ touchAction: "none" }}>
          ❚❚
        </button>
      </div>
    </div>
  );
}

// ─── Layout editor ───────────────────────────────────────────────────────────
// Every control is drawn where it sits; drag one to move it, and the selected
// one can be resized. Button size and opacity for all of them, mirroring,
// reset and Done sit in a panel at the top. Changes are saved as they're made.
const SHOWN = { fire: "FIRE", aim: "AIM", reload: "R", jump: "JUMP", crouch: "CROUCH", fire2: "FIRE", stick: "", weapons: "" };

function LayoutEditor({ lay, w, h, prefs, zoneRef, onPrefs, onDone }) {
  const [selected, setSelected] = useState("fire");
  const [panelLow, setPanelLow] = useState(false); // the panel can move out of the way
  const drag = useRef(null); // { id, pointerId, dx, dy }: finger offset from the control's centre
  const ids = Object.keys(CONTROL_DEFAULTS).filter(id => id !== "fire2" || prefs.leftFire);

  const down = (id) => (e) => {
    swallow(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = zoneRef.current.getBoundingClientRect();
    drag.current = { id, pointerId: e.pointerId, dx: e.clientX - rect.left - lay[id].x, dy: e.clientY - rect.top - lay[id].y };
    setSelected(id);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const rect = zoneRef.current.getBoundingClientRect();
    onPrefs(placeControl(prefs, d.id, e.clientX - rect.left - d.dx, e.clientY - rect.top - d.dy, w, h));
  };
  const up = () => { drag.current = null; };
  const k = prefs.layout[selected]?.k ?? 1;
  const slider = (label, value, [min, max], step, onChange, format) => (
    <label className="block text-xs text-slate-300">
      <div className="flex justify-between"><span>{label}</span><span className="font-mono">{format(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-indigo-400 h-6" />
    </label>
  );

  return (
    <div ref={zoneRef} className="absolute inset-0 select-none bg-slate-950/40" style={{ touchAction: "none" }}
      onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {w > 0 && ids.map(id => {
        const c = lay[id];
        const box = id === "weapons"
          ? { left: c.x - c.size * 4.6, top: c.y - c.size / 2, width: c.size * 9.2, height: c.size }
          : at(c);
        return (
          <div key={id} onPointerDown={down(id)}
            className={`absolute flex items-center justify-center border-2 text-white text-xs font-semibold ${
              id === "weapons" ? "rounded-lg" : "rounded-full"} ${
              selected === id ? "border-amber-300 bg-amber-400/30" : "border-white/50 bg-black/40"}`}
            style={{ ...box, touchAction: "none", opacity: prefs.opacity }}>
            {SHOWN[id] || CONTROL_DEFAULTS[id].label}
          </div>
        );
      })}

      <div className={`absolute left-1/2 ${panelLow ? "bottom-2" : "top-2"} -translate-x-1/2 w-[min(30rem,calc(100%-1rem))] rounded-xl bg-slate-900/95 border border-slate-700 p-3 space-y-2`}
        onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-white">Drag a control to move it. Selected: <span className="text-amber-300">{CONTROL_DEFAULTS[selected].label}</span></div>
          <button type="button" onClick={onDone} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Done</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {slider("Its size", k, SIZE_FACTOR, 0.05, v => onPrefs(resizeControl(prefs, selected, v)), v => `${Math.round(v * 100)}%`)}
          {slider("All buttons", prefs.scale, SCALE, 0.05, v => onPrefs({ ...prefs, scale: v }), v => `${Math.round(v * 100)}%`)}
          {slider("Opacity", prefs.opacity, OPACITY, 0.05, v => onPrefs({ ...prefs, opacity: v }), v => `${Math.round(v * 100)}%`)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onPrefs({ ...prefs, mirrored: !prefs.mirrored })}
            className={`px-3 py-2 rounded-lg border text-xs ${prefs.mirrored ? "border-indigo-400 bg-indigo-600/30 text-white" : "border-slate-600 bg-slate-800 text-slate-200"}`}>
            Left-handed
          </button>
          <button type="button" onClick={() => onPrefs(resetLayout(prefs))}
            className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-xs text-slate-200">
            Reset positions and sizes
          </button>
          <button type="button" onClick={() => setPanelLow(!panelLow)}
            className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-xs text-slate-200">
            Move this panel {panelLow ? "up ↑" : "down ↓"}
          </button>
        </div>
      </div>
    </div>
  );
}
