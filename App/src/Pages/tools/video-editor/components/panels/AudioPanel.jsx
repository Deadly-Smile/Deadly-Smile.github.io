import { useState, useRef, useEffect } from "react";
import { formatTime } from "../../utils/format";

export function AudioPanel({ editState, dispatch, currentTime, duration }) {
  const { audio, audioLayers } = editState;
  const hasAudio = editState.meta?.audioChannels > 0;

  const [newFile,  setNewFile]  = useState(null);
  const [newStart, setNewStart] = useState(0);
  const [newEnd,   setNewEnd]   = useState(5);
  const [newVol,   setNewVol]   = useState(1.0);
  const [newClip,  setNewClip]  = useState(0);     // offset into the source audio
  const [srcDur,   setSrcDur]   = useState(0);     // duration of the picked file

  const previewUrl = useRef(null);
  const previewRef = useRef(null);

  // Build/cleanup a preview object URL whenever the picked file changes.
  useEffect(() => {
    if (previewUrl.current) { URL.revokeObjectURL(previewUrl.current); previewUrl.current = null; }
    if (newFile) previewUrl.current = URL.createObjectURL(newFile);
    setSrcDur(0);
    return () => { if (previewUrl.current) { URL.revokeObjectURL(previewUrl.current); previewUrl.current = null; } };
  }, [newFile]);

  const addLayer = () => {
    if (!newFile) return;
    dispatch({
      type: "ADD_AUDIO_LAYER",
      layer: {
        id:        Date.now(),
        file:      newFile,
        label:     newFile.name,
        startTime: newStart,
        endTime:   newEnd,
        clipStart: newClip,
        volume:    newVol,
      },
    });
    setNewFile(null);
    setNewStart(0);
    setNewEnd(5);
    setNewVol(1.0);
    setNewClip(0);
  };

  // Preview the chosen audio segment ([clipStart, clipStart + window]).
  const playPreview = () => {
    const el = previewRef.current;
    if (!el) return;
    if (el.paused) { el.currentTime = newClip; el.play().catch(() => {}); }
    else { el.pause(); }
  };
  const onPreviewTime = (e) => {
    const windowLen = Math.max(0, newEnd - newStart);
    if (windowLen > 0 && e.target.currentTime >= newClip + windowLen) e.target.pause();
  };

  return (
    <div>
      <div className="ve-section-title">Original Track</div>
      <div className="ve-field">
        <label className="ve-toggle">
          <input type="checkbox" checked={audio.muted} onChange={e => dispatch({ type: "SET_AUDIO", audio: { muted: e.target.checked } })} disabled={!hasAudio} />
          <span className="ve-toggle-switch" />
          Mute original audio
        </label>
      </div>
      <div className="ve-field">
        <label className="ve-label">Volume <span>{Math.round(audio.volume * 100)}%</span></label>
        <input type="range" className="ve-slider" min={0} max={2} step={0.01} value={audio.volume}
          onChange={e => dispatch({ type: "SET_AUDIO", audio: { volume: parseFloat(e.target.value) } })}
          disabled={audio.muted || !hasAudio} />
      </div>

      <div className="ve-section-title">Audio Layers ({audioLayers.length})</div>
      {audioLayers.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--ve-text3)", marginBottom: 10 }}>No audio layers added yet.</p>
      )}
      {audioLayers.map((layer, i) => (
        <div className="ve-audio-layer-row" key={layer.id}>
          <div className="ve-audio-layer-header">
            <span className="ve-audio-layer-name">🎵 {layer.label}</span>
            <button className="ve-btn ve-btn-danger" style={{ padding: "2px 7px", fontSize: 11 }}
              onClick={() => dispatch({ type: "REMOVE_AUDIO_LAYER", index: i })}>✕</button>
          </div>
          <div className="ve-audio-layer-times">
            {formatTime(layer.startTime, true)} → {formatTime(layer.endTime, true)}
          </div>
          <div className="ve-field" style={{ marginBottom: 4, marginTop: 6 }}>
            <label className="ve-label">Volume <span>{Math.round(layer.volume * 100)}%</span></label>
            <input type="range" className="ve-slider" min={0} max={2} step={0.01} value={layer.volume}
              onChange={e => dispatch({ type: "UPDATE_AUDIO_LAYER", index: i, patch: { volume: parseFloat(e.target.value) } })} />
          </div>
          <div className="ve-row" style={{ gap: 8 }}>
            <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="ve-label">Start (s)</label>
              <input className="ve-input" type="number" step={0.1} min={0} value={layer.startTime}
                onChange={e => dispatch({ type: "UPDATE_AUDIO_LAYER", index: i, patch: { startTime: +e.target.value } })} />
            </div>
            <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="ve-label">End (s)</label>
              <input className="ve-input" type="number" step={0.1} min={0} value={layer.endTime}
                onChange={e => dispatch({ type: "UPDATE_AUDIO_LAYER", index: i, patch: { endTime: +e.target.value } })} />
            </div>
            <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="ve-label">Clip @ (s)</label>
              <input className="ve-input" type="number" step={0.1} min={0} value={layer.clipStart ?? 0}
                onChange={e => dispatch({ type: "UPDATE_AUDIO_LAYER", index: i, patch: { clipStart: +e.target.value } })} />
            </div>
          </div>
        </div>
      ))}

      <div className="ve-section-title">Add Audio Layer</div>
      <div className="ve-field">
        <label className="ve-btn" style={{ display: "block", textAlign: "center", cursor: "pointer" }}>
          <input type="file" accept="audio/mp3,audio/wav,audio/aac,audio/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { setNewFile(f); setNewEnd(Math.min(5, duration || 5)); } }} />
          {newFile ? `✓ ${newFile.name}` : "Choose Audio File…"}
        </label>
      </div>
      {newFile && (
        <>
          {/* In-editor preview of the picked file */}
          <audio
            ref={previewRef}
            src={previewUrl.current ?? undefined}
            onLoadedMetadata={e => setSrcDur(e.target.duration || 0)}
            onTimeUpdate={onPreviewTime}
            style={{ display: "none" }}
          />
          <div className="ve-row" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
            <button className="ve-btn" style={{ flex: 1 }} onClick={playPreview}>▶ / ⏸ Preview clip</button>
            <span style={{ fontFamily: "var(--ve-mono)", fontSize: 10, color: "var(--ve-text3)" }}>
              src {formatTime(srcDur)}
            </span>
          </div>

          <div className="ve-field">
            <label className="ve-label">Layer Volume <span>{Math.round(newVol * 100)}%</span></label>
            <input type="range" className="ve-slider" min={0} max={2} step={0.01} value={newVol} onChange={e => setNewVol(+e.target.value)} />
          </div>
          <div className="ve-field">
            <label className="ve-label">Clip Start in Source <span>{formatTime(newClip, true)}</span></label>
            <input type="range" className="ve-slider" min={0} max={Math.max(0.1, srcDur)} step={0.1} value={newClip}
              onChange={e => setNewClip(+e.target.value)} disabled={!srcDur} />
          </div>
          <div className="ve-row" style={{ gap: 8, marginBottom: 8 }}>
            <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="ve-label">Place Start (s)</label>
              <input className="ve-input" type="number" step={0.1} min={0} value={newStart} onChange={e => setNewStart(+e.target.value)} />
            </div>
            <div className="ve-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="ve-label">Place End (s)</label>
              <input className="ve-input" type="number" step={0.1} min={0} value={newEnd} onChange={e => setNewEnd(+e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button className="ve-btn" style={{ flex: 1 }} onClick={() => setNewStart(currentTime)}>Set Start at Playhead</button>
            <button className="ve-btn" style={{ flex: 1 }} onClick={() => setNewEnd(currentTime)}>Set End at Playhead</button>
          </div>
          <button className="ve-btn ve-btn-primary" style={{ width: "100%" }} onClick={addLayer}>
            Add Audio Layer
          </button>
        </>
      )}
      <p style={{ fontSize: 11, color: "var(--ve-text3)", marginTop: 8 }}>
        Audio layers are mixed over the original. “Clip @” picks where in the source file to start; the placement window sets where it lands on the video.
      </p>
    </div>
  );
}
