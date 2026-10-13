import { useState } from "react";
import * as engine from "./engine";
import { AVATARS, randomIdentity } from "./identity";

// Setup-screen building blocks shared by the menu (solo / host) and both
// lobbies: who you are, the table's settings, and who's sitting where.

const chip = (active) =>
  `px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
    active ? "bg-indigo-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-200"
  }`;

export function Avatar({ avatar, size = "md" }) {
  const dims = size === "lg" ? "w-12 h-12 text-3xl" : size === "sm" ? "w-5 h-5 text-xs sm:w-6 sm:h-6 sm:text-sm" : "w-8 h-8 text-lg sm:w-9 sm:h-9 sm:text-xl";
  return (
    <span className={`${dims} inline-flex items-center justify-center rounded-full bg-slate-700 border border-slate-500 flex-shrink-0 leading-none`}>
      {avatar || "🙂"}
    </span>
  );
}

// Your avatar + name. The name comes pre-filled from a random identity so
// typing one is optional; 🎲 re-rolls both.
export function IdentityPicker({ identity, onChange }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setPicking(v => !v)} title="Pick an avatar" className="rounded-full hover:ring-2 hover:ring-indigo-500 transition">
          <Avatar avatar={identity.avatar} size="lg" />
        </button>
        <input
          value={identity.name}
          maxLength={16}
          placeholder="Your name"
          onChange={e => onChange({ ...identity, name: e.target.value })}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => onChange(randomIdentity([identity]))}
          title="Random avatar and name"
          className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 text-lg transition-colors"
        >🎲</button>
      </div>
      {picking && (
        <div className="mt-2 grid grid-cols-8 gap-1 bg-slate-900 border border-slate-700 rounded-xl p-2">
          {AVATARS.map(a => (
            <button
              key={a}
              onClick={() => { onChange({ ...identity, avatar: a }); setPicking(false); }}
              className={`h-8 rounded-lg text-xl hover:bg-slate-700 ${a === identity.avatar ? "bg-indigo-700" : ""}`}
            >{a}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-300 flex-shrink-0">{label}</span>
      <div className="flex flex-wrap justify-end gap-1">{children}</div>
    </div>
  );
}

const rebuyLabel = limit => (limit === 0 ? "Off" : limit == null ? "∞" : String(limit));

// `seatCount`/`onSeatCount` are optional — the host lobby edits seats through
// the seat list instead. With `readOnly`, renders a one-line summary.
export function TableSettings({ config, onChange, seatCount, onSeatCount, readOnly }) {
  const c = engine.normalizeConfig(config);
  if (readOnly) return <p className="text-xs text-slate-400 mb-4">{engine.describeConfig(c)}</p>;

  const set = patch => onChange(engine.normalizeConfig({ ...c, ...patch }));
  const rebuyLimit = c.rebuyEnabled ? c.maxRebuys : 0;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 mb-4 divide-y divide-slate-800">
      {onSeatCount && (
        <Row label="Players">
          {Array.from({ length: engine.MAX_SEATS - engine.MIN_SEATS + 1 }, (_, i) => i + engine.MIN_SEATS).map(n => (
            <button key={n} onClick={() => onSeatCount(n)} className={chip(n === seatCount)}>{n}</button>
          ))}
        </Row>
      )}
      <Row label="Buy-in">
        {engine.STACK_PRESETS.map(v => (
          <button key={v} onClick={() => set({ startingStack: v })} className={chip(v === c.startingStack)}>
            ${v >= 1000 ? `${v / 1000}k` : v}
          </button>
        ))}
        <input
          type="number" min={c.bigBlind * 2} step={c.bigBlind} value={c.startingStack}
          onChange={e => set({ startingStack: Number(e.target.value) })}
          className="w-20 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-xs font-mono outline-none focus:border-indigo-500"
          title="Custom starting stack"
        />
      </Row>
      <Row label="Blinds">
        {engine.BLIND_PRESETS.map(([sb, bb]) => (
          <button key={bb} onClick={() => set({ smallBlind: sb, bigBlind: bb })} className={chip(bb === c.bigBlind && sb === c.smallBlind)}>
            {sb}/{bb}
          </button>
        ))}
      </Row>
      <Row label="Re-buys">
        {engine.REBUY_LIMITS.map(limit => (
          <button
            key={rebuyLabel(limit)}
            onClick={() => set({ rebuyEnabled: limit !== 0, maxRebuys: limit === 0 ? c.maxRebuys : limit })}
            className={chip(limit === rebuyLimit)}
          >{rebuyLabel(limit)}</button>
        ))}
      </Row>
    </div>
  );
}

// Lobby seat list. Seats nobody has claimed are AI-controlled; a joining
// player takes over the first one, and any still unclaimed at the start
// simply stay AI.
export function SeatList({ players, hostSeat = 0, mySeatId, onAdd, onRemove }) {
  const editable = !!onRemove;
  return (
    <div className="text-left bg-slate-900 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">Players ({players.length}/{engine.MAX_SEATS})</p>
        {onAdd && (
          <button
            onClick={onAdd}
            disabled={players.length >= engine.MAX_SEATS}
            className="px-2.5 py-1 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold transition-colors"
          >+ Add seat</button>
        )}
      </div>
      <ul className="space-y-1.5 text-sm">
        {players.map((p, i) => {
          const status = i === hostSeat ? "Host"
            : p.isHuman ? (i === mySeatId ? "You" : "✅ Player")
            : "🤖 AI · open seat";
          return (
            <li key={p.id} className="flex justify-between items-center gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <Avatar avatar={p.avatar} size="sm" />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs ${p.isHuman ? "text-emerald-400" : "text-slate-500"}`}>{status}</span>
                {editable && i !== hostSeat && (
                  <button
                    onClick={() => onRemove(i)}
                    disabled={players.length <= engine.MIN_SEATS}
                    title={p.isHuman ? "Remove (kicks this player)" : "Remove seat"}
                    className="w-5 h-5 rounded-full bg-red-800/60 hover:bg-red-700 disabled:opacity-20 disabled:cursor-not-allowed text-[11px] leading-5 text-center transition-colors"
                  >✕</button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
