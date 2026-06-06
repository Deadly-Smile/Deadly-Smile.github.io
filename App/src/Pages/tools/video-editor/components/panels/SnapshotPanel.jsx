import { useRef } from "react";
import { formatTime } from "../../utils/format";

export function SnapshotPanel({ editState, dispatch, videoRef }) {
  const canvasRef = useRef(null);

  const takeSnapshot = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width  = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    dispatch({ type: "ADD_SNAPSHOT", snap: { id: Date.now(), dataUrl, time: v.currentTime } });
  };

  const download = (snap) => {
    const a = document.createElement("a");
    a.href = snap.dataUrl;
    a.download = `snapshot_${formatTime(snap.time).replace(/:/g, "-")}.jpg`;
    a.click();
  };

  return (
    <div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="ve-section-title">Frame Snapshots</div>
      <button className="ve-btn ve-btn-primary" style={{ width: "100%", marginBottom: 12 }}
        disabled={!editState.sourceFile}
        onClick={takeSnapshot}>
        📸 Snapshot Current Frame
      </button>
      {editState.snapshots.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--ve-text3)" }}>No snapshots yet. Pause the video on a frame and click above.</p>
      )}
      <div className="ve-snapshot-strip">
        {editState.snapshots.map((snap, i) => (
          <div className="ve-snapshot-thumb" key={snap.id} onClick={() => download(snap)} title={`t=${formatTime(snap.time, true)} — click to download`}>
            <img src={snap.dataUrl} alt={`snap ${i}`} />
            <button className="ve-snapshot-del" onClick={e => { e.stopPropagation(); dispatch({ type: "REMOVE_SNAPSHOT", index: i }); }}>✕</button>
          </div>
        ))}
      </div>
      {editState.snapshots.length > 0 && (
        <p style={{ fontSize: 11, color: "var(--ve-text3)", marginTop: 8 }}>Click a thumbnail to download. Hover to remove.</p>
      )}
    </div>
  );
}
