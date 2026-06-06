import { PRESET_FILTERS } from "../../constants";
import { formatTime } from "../../utils/format";

export function FiltersPanel({ editState, dispatch, currentTime, duration }) {
  const { filters, activeFilter, filterRange } = editState;
  const setPreset = (name) => {
    const p = PRESET_FILTERS[name];
    const next = activeFilter === name ? null : name;
    dispatch({ type: "SET_ACTIVE_FILTER", name: next });
    dispatch({ type: "SET_FILTER", filters: next ? { brightness: p.brightness, contrast: p.contrast, saturation: p.saturation } : { brightness: 0, contrast: 1, saturation: 1 } });
  };
  const ranged = !!filterRange;
  const rStart = filterRange?.start ?? 0;
  const rEnd   = filterRange?.end   ?? (duration || 0);
  return (
    <div>
      <div className="ve-section-title">Preset Looks</div>
      <div className="ve-filter-grid">
        {Object.entries(PRESET_FILTERS).map(([key, p]) => (
          <button key={key} className={`ve-filter-chip${activeFilter === key ? " active" : ""}`} onClick={() => setPreset(key)}>{p.label}</button>
        ))}
      </div>
      <div className="ve-section-title">Manual Adjustments</div>
      {[["Brightness", "brightness", -1, 1, 0.01, v => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`],
        ["Contrast", "contrast", 0.5, 2, 0.01, v => `${v.toFixed(2)}×`],
        ["Saturation", "saturation", 0, 3, 0.01, v => `${v.toFixed(2)}×`],
        ["Speed", "speed", 0.5, 2, 0.05, v => `${v.toFixed(2)}×`]
      ].map(([label, key, min, max, step, fmt]) => (
        <div className="ve-field" key={key}>
          <label className="ve-label">{label} <span>{fmt(filters[key])}</span></label>
          <input type="range" className="ve-slider" min={min} max={max} step={step} value={filters[key]}
            onChange={e => dispatch({ type: "SET_FILTER", filters: { [key]: +e.target.value } })} />
        </div>
      ))}

      <div className="ve-section-title">Look Timing</div>
      <div className="ve-field">
        <label className="ve-toggle">
          <input type="checkbox" checked={ranged}
            onChange={e => dispatch({ type: "SET_FILTER_RANGE", range: e.target.checked ? { start: 0, end: duration || 0 } : null })} />
          <span className="ve-toggle-switch" />
          Apply look only to a time range
        </label>
      </div>
      {ranged && (
        <>
          <div className="ve-audio-layer-times" style={{ marginBottom: 8 }}>
            {formatTime(rStart, true)} → {formatTime(rEnd, true)}
          </div>
          <div className="ve-row" style={{ gap: 8, marginBottom: 8 }}>
            <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="ve-label">Start (s)</label>
              <input className="ve-input" type="number" step={0.1} min={0} value={rStart}
                onChange={e => dispatch({ type: "SET_FILTER_RANGE", range: { start: +e.target.value, end: rEnd } })} />
            </div>
            <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="ve-label">End (s)</label>
              <input className="ve-input" type="number" step={0.1} min={0} value={rEnd}
                onChange={e => dispatch({ type: "SET_FILTER_RANGE", range: { start: rStart, end: +e.target.value } })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ve-btn" style={{ flex: 1 }} onClick={() => dispatch({ type: "SET_FILTER_RANGE", range: { start: currentTime, end: rEnd } })}>Set Start at Playhead</button>
            <button className="ve-btn" style={{ flex: 1 }} onClick={() => dispatch({ type: "SET_FILTER_RANGE", range: { start: rStart, end: currentTime } })}>Set End at Playhead</button>
          </div>
          <p style={{ fontSize: 11, color: "var(--ve-text3)", marginTop: 8 }}>
            Color/brightness adjustments apply only within this window. Speed stays global.
          </p>
        </>
      )}
    </div>
  );
}
