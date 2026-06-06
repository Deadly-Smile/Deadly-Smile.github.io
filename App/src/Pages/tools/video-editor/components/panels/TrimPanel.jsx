import { formatTime } from "../../utils/format";

export function TrimPanel({ editState, dispatch, currentTime, duration }) {
  const inPoint  = editState.trim?.in  ?? 0;
  const outPoint = editState.trim?.out ?? duration;
  return (
    <div>
      <div className="ve-section-title">Selection</div>
      <div className="ve-meta-grid" style={{ marginBottom: 14 }}>
        {[["In Point", formatTime(inPoint, true)], ["Out Point", formatTime(outPoint, true)], ["Selection", formatTime(outPoint - inPoint, true)], ["Full Dur", formatTime(duration, true)]].map(([k, v]) => (
          <div className="ve-meta-item" key={k}><div className="ve-meta-key">{k}</div><div className="ve-meta-val">{v}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="ve-btn" style={{ width: "100%" }} onClick={() => dispatch({ type: "SET_TRIM", trim: { in: currentTime, out: outPoint } })} disabled={currentTime >= outPoint - 0.1}>Set In at Playhead</button>
        <button className="ve-btn" style={{ width: "100%" }} onClick={() => dispatch({ type: "SET_TRIM", trim: { in: inPoint, out: currentTime } })} disabled={currentTime <= inPoint + 0.1}>Set Out at Playhead</button>
        <button className="ve-btn ve-btn-danger" style={{ width: "100%" }} onClick={() => dispatch({ type: "SET_TRIM", trim: null })}>Clear Trim</button>
      </div>
    </div>
  );
}
