import { useState } from "react";
import { EXPORT_PRESETS } from "../../constants";

export function ExportPanel({ editState, onExport, exporting, setExporting }) {
  const [preset, setPreset] = useState("web");
  const [localError, setLocalError] = useState(null);

  const handleExport = async () => {
    if (!editState.sourceFile || exporting) return;
    setLocalError(null);

    try {
      await onExport(preset);
    } catch (err) {
      setLocalError(err?.message ?? "Export failed — check the console.");
    }
  };

  return (
    <div>
      <div className="ve-section-title">Export Preset</div>

      {EXPORT_PRESETS.map(p => (
        <div
          key={p.id}
          className={`ve-export-preset${preset === p.id ? " selected" : ""}`}
          onClick={() => !exporting && setPreset(p.id)}
          style={{ cursor: exporting ? "not-allowed" : "pointer", opacity: exporting && preset !== p.id ? 0.5 : 1 }}
        >
          <div className="ve-export-preset-name">{p.name}</div>
          <div className="ve-export-preset-desc">{p.desc}</div>
        </div>
      ))}

      <button
        className="ve-btn ve-btn-primary"
        style={{ width: "100%", marginTop: 8 }}
        disabled={!editState.sourceFile || exporting}
        onClick={handleExport}
      >
        {exporting ? "Processing…" : "Export Video"}
      </button>

      {localError && (
        <p style={{ fontSize: 11, color: "var(--ve-error, #f87171)", marginTop: 6 }}>
          ⚠ {localError}
        </p>
      )}

      <p style={{ fontSize: 11, color: "var(--ve-text3)", marginTop: 8 }}>
        All processing is local — no data leaves your device.
      </p>
    </div>
  );
}