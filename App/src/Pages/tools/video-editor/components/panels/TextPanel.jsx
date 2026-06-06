import { useState } from "react";
import { formatTime } from "../../utils/format";

const COLORS = ["#ffffff", "#ffff00", "#ff4444", "#44aaff", "#44ff88", "#ff88cc", "#000000"];

export function TextPanel({ editState, dispatch, currentTime }) {
  const [text,  setText]  = useState("Sample Text");
  const [size,  setSize]  = useState(48);
  const [color, setColor] = useState("#ffffff");
  const [xPct,  setXPct]  = useState(10);
  const [yPct,  setYPct]  = useState(10);
  const [start, setStart] = useState(0);
  const [end,   setEnd]   = useState(5);

  return (
    <div>
      <div className="ve-section-title">Existing Overlays</div>
      <div className="ve-text-layer-list">
        {editState.textLayers.length === 0 && <p style={{ fontSize: 12, color: "var(--ve-text3)" }}>No text overlays yet.</p>}
        {editState.textLayers.map((layer, i) => (
          <div className="ve-text-layer-row" key={layer.id}>
            <span>{layer.text}</span>
            <span style={{ color: "var(--ve-text3)", fontSize: 10 }}>{formatTime(layer.startTime)}→{formatTime(layer.endTime)}</span>
            <button className="ve-btn ve-btn-danger" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => dispatch({ type: "REMOVE_TEXT_LAYER", index: i })}>✕</button>
          </div>
        ))}
      </div>
      <div className="ve-section-title">Add Overlay</div>
      <div className="ve-field"><label className="ve-label">Text Content</label><input className="ve-input" value={text} onChange={e => setText(e.target.value)} placeholder="Enter text…" /></div>
      <div className="ve-field"><label className="ve-label">Font Size <span>{size}px</span></label><input type="range" className="ve-slider" min={16} max={120} value={size} onChange={e => setSize(+e.target.value)} /></div>
      <div className="ve-field">
        <label className="ve-label">Color</label>
        <div className="ve-color-row">{COLORS.map(c => <div key={c} className={`ve-color-chip${color === c ? " selected" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
      </div>
      <div className="ve-field"><label className="ve-label">X <span>{Math.round(xPct)}%</span></label><input type="range" className="ve-slider" min={0} max={95} value={xPct} onChange={e => setXPct(+e.target.value)} /></div>
      <div className="ve-field"><label className="ve-label">Y <span>{Math.round(yPct)}%</span></label><input type="range" className="ve-slider" min={0} max={95} value={yPct} onChange={e => setYPct(+e.target.value)} /></div>
      <div className="ve-row" style={{ gap: 8, marginBottom: 8 }}>
        <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}><label className="ve-label">Start (s)</label><input className="ve-input" type="number" step={0.1} min={0} value={start} onChange={e => setStart(+e.target.value)} /></div>
        <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}><label className="ve-label">End (s)</label><input className="ve-input" type="number" step={0.1} min={0} value={end} onChange={e => setEnd(+e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="ve-btn" style={{ flex: 1 }} onClick={() => setStart(currentTime)}>Set Start</button>
        <button className="ve-btn" style={{ flex: 1 }} onClick={() => setEnd(currentTime)}>Set End</button>
      </div>
      <button className="ve-btn ve-btn-primary" style={{ width: "100%", marginTop: 10 }} disabled={!text.trim()}
        onClick={() => dispatch({ type: "ADD_TEXT_LAYER", layer: { text, size, color, xPct, yPct, startTime: start, endTime: end, id: Date.now() } })}>
        Add Overlay
      </button>
    </div>
  );
}
