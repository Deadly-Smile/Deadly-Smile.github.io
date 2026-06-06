import { useState, useEffect, useRef, useCallback, useReducer, useMemo } from "react";
import { STYLES } from "../styles";
import { TABS } from "../constants";
import { PRESET_FILTERS } from "../constants";
import { formatTime, formatSize, clamp } from "../utils/format";
import { buildFFmpegCommand } from "../utils/buildFFmpegCommand";
import { editReducer, initialEditState } from "../state/editReducer";
import { useFFmpeg } from "../../../../context/FFmpegContext";
import { Timeline } from "./Timeline";
import {
  MetaPanel, TrimPanel, AudioPanel, FiltersPanel, TextPanel, SnapshotPanel, ExportPanel,
} from "./panels";

export function VideoEditorInner() {
  const ffmpegCtx = useFFmpeg();
  const [editState, dispatch]     = useReducer(editReducer, initialEditState);
  const [activeTab,  setActiveTab]  = useState("trim");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState(null);
  const [dragging, setDragging]     = useState(false);  // drag-over state
  const [ffmpegStatus, setFfmpegStatus] = useState("idle");
  const [videoUrl, setVideoUrl]     = useState(null);   // declarative <video> src

  const videoRef     = useRef(null);
  const objectUrlRef = useRef(null);
  const rafRef       = useRef(null);
  const exportLock   = useRef(false);
  const audioElsRef  = useRef(new Map());   // layer.id -> HTMLAudioElement
  const audioUrlCacheRef = useRef(new Map()); // layer.id -> { file, url }

  const duration = editState.meta?.duration ?? 0;
  const inPoint  = editState.trim?.in  ?? 0;
  const outPoint = editState.trim?.out ?? duration;

  // Inject styles
  useEffect(() => {
    const id = "ve-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
  }, []);

  // Object URLs for each audio layer, cached per layer id (so volume/time edits
  // don't recreate the URL and reload the <audio> element).
  const audioUrls = useMemo(() => {
    const cache = audioUrlCacheRef.current;
    const seen = new Set();
    const result = {};
    editState.audioLayers.forEach(layer => {
      seen.add(layer.id);
      let entry = cache.get(layer.id);
      if (!entry || entry.file !== layer.file) {
        if (entry) URL.revokeObjectURL(entry.url);
        entry = { file: layer.file, url: URL.createObjectURL(layer.file) };
        cache.set(layer.id, entry);
      }
      result[layer.id] = entry.url;
    });
    for (const [id, entry] of cache) {
      if (!seen.has(id)) { URL.revokeObjectURL(entry.url); cache.delete(id); }
    }
    return result;
  }, [editState.audioLayers]);

  // Keep audio-layer <audio> elements in sync with the video playhead.
  const syncAudioLayers = useCallback((time, isPlaying) => {
    editState.audioLayers.forEach(layer => {
      const el = audioElsRef.current.get(layer.id);
      if (!el) return;
      // HTMLMediaElement.volume is capped at 1; UI allows up to 2.
      el.volume = clamp(layer.volume ?? 1, 0, 1);
      const active = time >= layer.startTime && time < layer.endTime;
      if (active) {
        const local = (layer.clipStart ?? 0) + (time - layer.startTime);
        if (Math.abs(el.currentTime - local) > 0.25) el.currentTime = local;
        if (isPlaying && el.paused) el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else if (!el.paused) {
        el.pause();
      }
    });
  }, [editState.audioLayers]);

  // Apply original-track mute/volume to the preview video.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = editState.audio.muted;
    v.volume = clamp(editState.audio.volume ?? 1, 0, 1);
  }, [editState.audio, videoUrl]);

  const syncPlayhead = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      syncAudioLayers(t, true);
      rafRef.current = requestAnimationFrame(syncPlayhead);
    }
  }, [syncAudioLayers]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); syncAudioLayers(v.currentTime, true); rafRef.current = requestAnimationFrame(syncPlayhead); }
    else { v.pause(); setPlaying(false); syncAudioLayers(v.currentTime, false); cancelAnimationFrame(rafRef.current); }
  }, [syncPlayhead, syncAudioLayers]);

  const seekBy = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    const t = clamp(v.currentTime + delta, 0, duration);
    v.currentTime = t; setCurrentTime(t);
    syncAudioLayers(t, !v.paused);
  }, [duration, syncAudioLayers]);

  const handleSeek = (t) => {
    if (!videoRef.current) return;
    const clamped = clamp(t, 0, duration);
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    syncAudioLayers(clamped, !videoRef.current.paused);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (e.code === "ArrowLeft")  seekBy(-1 / (editState.meta?.fps || 30));
      else if (e.code === "ArrowRight") seekBy(1 / (editState.meta?.fps || 30));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [editState.meta, togglePlay, seekBy]);

  const extractMeta = useCallback(async (file) => {
    return new Promise((resolve) => {
      const vid = document.createElement("video");
      vid.preload = "metadata";
      const url = URL.createObjectURL(file);
      vid.onloadedmetadata = () => {
        resolve({ duration: vid.duration, width: vid.videoWidth, height: vid.videoHeight, fps: null, videoCodec: null, audioChannels: 1, bitrate: null });
        URL.revokeObjectURL(url);
      };
      vid.onerror = () => resolve({ duration: 0, width: 0, height: 0, fps: null, videoCodec: null, audioChannels: 0, bitrate: null });
      vid.src = url;
    });
  }, []);

  const loadFile = useCallback(async (file) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) { setExportError("File exceeds 500 MB limit."); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const meta = await extractMeta(file);
    dispatch({ type: "SET_FILE", file, meta });
    setVideoUrl(url);
    setCurrentTime(0);
    setExportError(null);
  }, [extractMeta]);

  // ── Unified drag handlers on the preview container ──
  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const handleDrop      = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  const handleExport = useCallback(async (presetId) => {
    if (exportLock.current) return;
    exportLock.current = true;

    setExporting(true);
    setExportError(null);
    setExportProgress(0);

    try {
      // ── 1. Ensure FFmpeg is loaded ──────────────────────────────────────
      if (!ffmpegCtx.ffmpeg) {
        setFfmpegStatus("loading");
        try {
          await ffmpegCtx.load();
          setFfmpegStatus("ready");
        } catch (loadErr) {
          throw new Error("FFmpeg failed to load: " + (loadErr?.message ?? loadErr));
        }
      }

      const ff = ffmpegCtx.ffmpeg;
      if (!ff) throw new Error("FFmpeg is not available.");

      const fetchFile = ffmpegCtx.getFetchFile?.();
      if (typeof fetchFile !== "function") {
        throw new Error("fetchFile helper is not available.");
      }

      // ── 2. Pre-clean virtual FS to avoid ErrnoError on stale files ──────
      // A previous failed export may have left files behind.
      const cmd = buildFFmpegCommand(editState, presetId);
      const outputName = cmd.output ?? "output.mp4";

      const staleFiles = [
        "input.mp4",
        outputName,
        ...(cmd.pass1 ? ["palette.png"] : []),
        ...editState.audioLayers.map((_, i) => `audio_${i}.mp3`),
      ];
      for (const f of staleFiles) {
        try { await ff.deleteFile(f); } catch (_) { /* doesn't exist, that's fine */ }
      }

      // ── 3. Write inputs ─────────────────────────────────────────────────
      console.log("[Export] Writing input.mp4...");
      await ff.writeFile("input.mp4", await fetchFile(editState.sourceFile));
      console.log("[Export] input.mp4 written OK");

      for (let i = 0; i < editState.audioLayers.length; i++) {
        await ff.writeFile(`audio_${i}.mp3`, await fetchFile(editState.audioLayers[i].file));
      }

      // ── 4. Run FFmpeg ───────────────────────────────────────────────────
      ff.off("progress");
      ff.on("progress", ({ progress }) =>
        setExportProgress(clamp(progress, 0, 1))
      );

      console.log("[Export] Running FFmpeg command:", cmd.pass1 ?? cmd.args);
      if (cmd.pass1) {
        await ff.exec(cmd.pass1);
        await ff.exec(cmd.pass2);
      } else {
        await ff.exec(cmd.args);
      }
      console.log("[Export] FFmpeg exec finished");

      // ── 5. Read output & trigger download ───────────────────────────────
      const data = await ff.readFile(outputName);

      const mime =
        presetId === "gif"   ? "image/gif"  :
        presetId === "audio" ? "audio/mpeg" :
        "video/mp4";

      const blob = new Blob([data], { type: mime });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `export.${outputName.split(".").pop()}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // ── 6. Clean up ─────────────────────────────────────────────────────
      for (const f of staleFiles) {
        try { await ff.deleteFile(f); } catch (_) {}
      }

    } catch (err) {
      console.error("[VideoEditor] Export error:", err);
      setExportError(err?.message ?? "Export failed.");
    } finally {
      exportLock.current = false;
      setExporting(false);
      setExportProgress(0);
    }
  }, [editState, ffmpegCtx]);

  // ─── Also fix the on-mount FFmpeg load useEffect ────────────────────────────
  // Original called ffmpegCtx.load() unconditionally every mount.
  // If load() throws (e.g. missing SharedArrayBuffer), status is stuck on "loading".
  useEffect(() => {
    if (ffmpegCtx.ffmpeg) {
      setFfmpegStatus("ready");
      return;
    }
    setFfmpegStatus("loading");
    ffmpegCtx
      .load()
      .then(() => setFfmpegStatus("ready"))
      .catch((err) => {
        console.error("[VideoEditor] FFmpeg load error:", err);
        setFfmpegStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    setFfmpegStatus("loading");
    ffmpegCtx.load().then(() => setFfmpegStatus("ready")).catch(() => setFfmpegStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewFilter = editState.activeFilter
    ? PRESET_FILTERS[editState.activeFilter]?.css
    : `brightness(${1 + editState.filters.brightness}) contrast(${editState.filters.contrast}) saturate(${editState.filters.saturation})`;

  // A time-ranged look only applies while the playhead is inside the window.
  const lookActive = !editState.filterRange
    || (currentTime >= editState.filterRange.start && currentTime <= editState.filterRange.end);
  const appliedFilter = lookActive ? previewFilter : "none";

  return (
    <>
      <style>{STYLES}</style>
      <div className="ve-root">
        {/* Top Bar */}
        <div className="ve-topbar">
          <span className="ve-topbar-brand">VE</span>
          <label className="ve-btn" style={{ cursor: "pointer" }}>
            <input type="file" accept="video/*,.mkv,.avi,.mov" style={{ display: "none" }}
              onChange={e => loadFile(e.target.files?.[0])} />
            Open File
          </label>
          {editState.sourceFile && (
            <span style={{ fontSize: 12, color: "var(--ve-text2)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {editState.sourceFile.name}
            </span>
          )}
          <div className="ve-topbar-spacer" />
          {ffmpegCtx.hasSharedArrayBuffer
            ? <span className="ve-badge ve-badge-ok">SAB ✓</span>
            : <span className="ve-badge ve-badge-warn">SAB ✗ Slow</span>
          }
          {ffmpegStatus === "ready"   && <span className="ve-badge ve-badge-ok">FFmpeg Ready</span>}
          {ffmpegStatus === "loading" && <span className="ve-badge ve-badge-warn">Loading…</span>}
          {ffmpegStatus === "error"   && <span className="ve-badge ve-badge-err">FFmpeg Error</span>}
          <button className="ve-btn ve-btn-primary" disabled={!editState.sourceFile || exporting}
            onClick={() => setActiveTab("export")}>Export</button>
        </div>

        {/* Workspace */}
        <div className="ve-workspace">
          {/* Preview */}
          <div className="ve-preview"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!editState.sourceFile ? (
              <label className={`ve-drop-zone${dragging ? " dragging" : ""}`}>
                <input type="file" accept="video/*,.mkv,.avi,.mov" onChange={e => loadFile(e.target.files?.[0])} />
                <div className="ve-drop-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <span className="ve-drop-label">Drop video or click to open</span>
                <span style={{ fontSize: 11, color: "var(--ve-text3)", fontFamily: "var(--ve-mono)" }}>MP4 · MOV · WebM · MKV · AVI · max 500 MB</span>
              </label>
            ) : (
              <>
                <video ref={videoRef}
                  src={videoUrl ?? undefined}
                  style={{ filter: appliedFilter, maxWidth: "100%", maxHeight: "100%" }}
                  onEnded={() => { setPlaying(false); syncAudioLayers(0, false); }}
                  onTimeUpdate={e => !playing && setCurrentTime(e.target.currentTime)}
                  playsInline
                />
                {/* Hidden players for audio layers — kept in sync with the video */}
                {editState.audioLayers.map(layer => (
                  <audio
                    key={layer.id}
                    src={audioUrls[layer.id]}
                    ref={el => {
                      if (el) audioElsRef.current.set(layer.id, el);
                      else audioElsRef.current.delete(layer.id);
                    }}
                    preload="auto"
                    style={{ display: "none" }}
                  />
                ))}
                {/* Drag overlay when file already loaded */}
                {dragging && (
                  <div className="ve-drag-overlay">
                    <span>Drop to replace video</span>
                  </div>
                )}
                {/* Text overlays */}
                <div className="ve-text-overlay" style={{ inset: 0 }}>
                  {editState.textLayers.filter(l => currentTime >= l.startTime && currentTime <= l.endTime).map(layer => (
                    <div key={layer.id} className="ve-text-overlay-item"
                      style={{ left: `${layer.xPct}%`, top: `${layer.yPct}%`, fontSize: `${layer.size}px`, color: layer.color }}>
                      {layer.text}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Control Panel */}
          <div className="ve-controls">
            <div className="ve-tabs" role="tablist">
              {TABS.map(t => (
                <button key={t.id} role="tab" aria-selected={activeTab === t.id}
                  className={`ve-tab${activeTab === t.id ? " active" : ""}`}
                  onClick={() => setActiveTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <div className="ve-panel" role="tabpanel">
              {activeTab === "meta"     && <MetaPanel meta={editState.meta} file={editState.sourceFile} />}
              {activeTab === "trim"     && <TrimPanel editState={editState} dispatch={dispatch} currentTime={currentTime} duration={duration} />}
              {activeTab === "audio"    && <AudioPanel editState={editState} dispatch={dispatch} currentTime={currentTime} duration={duration} />}
              {activeTab === "filters"  && <FiltersPanel editState={editState} dispatch={dispatch} currentTime={currentTime} duration={duration} />}
              {activeTab === "text"     && <TextPanel editState={editState} dispatch={dispatch} currentTime={currentTime} videoRef={videoRef} />}
              {activeTab === "snapshot" && <SnapshotPanel editState={editState} dispatch={dispatch} videoRef={videoRef} />}
              {activeTab === "export"   && <ExportPanel editState={editState} onExport={handleExport} exporting={exporting} setExporting={setExporting} />}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="ve-timeline-area">
          <div className="ve-timeline-controls">
            <button className="ve-play-btn" onClick={togglePlay} disabled={!editState.sourceFile} aria-label={playing ? "Pause" : "Play"}>
              {playing
                ? <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect x="0" y="0" width="3" height="12" /><rect x="7" y="0" width="3" height="12" /></svg>
                : <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><polygon points="0,0 10,6 0,12" /></svg>
              }
            </button>
            <span className="ve-time-display">{formatTime(currentTime, true)}</span>
            <span style={{ color: "var(--ve-text3)", fontSize: 12 }}>/</span>
            <span style={{ fontFamily: "var(--ve-mono)", fontSize: 12, color: "var(--ve-text2)" }}>{formatTime(duration, true)}</span>
            {editState.trim && (
              <span className="ve-badge ve-badge-ok" style={{ marginLeft: 8 }}>
                {formatTime(inPoint, true)} → {formatTime(outPoint, true)}
              </span>
            )}
            {editState.audioLayers.length > 0 && (
              <span className="ve-badge ve-badge-warn">{editState.audioLayers.length} audio layer{editState.audioLayers.length > 1 ? "s" : ""}</span>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--ve-mono)", fontSize: 10, color: "var(--ve-text3)" }}>← → frame · Space play</span>
          </div>
          <Timeline
            duration={duration}
            currentTime={currentTime}
            inPoint={inPoint}
            outPoint={outPoint}
            onSeek={handleSeek}
            onInChange={t => dispatch({ type: "SET_TRIM", trim: { in: t, out: outPoint } })}
            onOutChange={t => dispatch({ type: "SET_TRIM", trim: { in: inPoint, out: t } })}
            sourceFile={editState.sourceFile}
            audioLayers={editState.audioLayers}
          />
        </div>

        {/* Status Bar */}
        <div className="ve-statusbar">
          {exporting ? (
            <>
              <span className="ve-status-item"><span style={{ color: "var(--ve-accent)" }}>●</span>EXPORTING</span>
              <div className="ve-progress-bar-wrap"><div className="ve-progress-bar-fill" style={{ width: `${exportProgress * 100}%` }} /></div>
              <span style={{ color: "var(--ve-text2)", fontSize: 10 }}>{Math.round(exportProgress * 100)}%</span>
            </>
          ) : (
            <>
              <span className="ve-status-item">
                <span style={{ color: ffmpegStatus === "ready" ? "var(--ve-success)" : ffmpegStatus === "loading" ? "var(--ve-accent)" : "var(--ve-text3)" }}>●</span>
                {ffmpegStatus === "ready" ? "READY" : ffmpegStatus === "loading" ? "LOADING FFMPEG" : "STANDBY"}
              </span>
              {editState.sourceFile && <span className="ve-status-item">{editState.sourceFile.name}</span>}
              {editState.meta && <><span className="ve-status-item">{editState.meta.width}×{editState.meta.height}</span><span className="ve-status-item">{formatTime(duration)}</span><span className="ve-status-item">{formatSize(editState.sourceFile?.size)}</span></>}
              {editState.textLayers.length > 0 && <span className="ve-status-item">{editState.textLayers.length} text</span>}
              {editState.audioLayers.length > 0 && <span className="ve-status-item">{editState.audioLayers.length} audio</span>}
              {editState.snapshots.length > 0 && <span className="ve-status-item">{editState.snapshots.length} snap</span>}
            </>
          )}
          {exportError && <span className="ve-error-msg">⚠ {exportError}</span>}
          <div style={{ flex: 1 }} />
          <span className="ve-status-item">MAX 500 MB · H.264 · NO UPLOAD</span>
        </div>

        {/* FFmpeg overlay */}
        {ffmpegCtx.loading && (
          <div className="ve-loading-overlay">
            <div className="ve-loading-spinner" />
            <div className="ve-loading-text">Loading FFmpeg</div>
            <div className="ve-loading-sub">~30 MB · cached after first load</div>
            {ffmpegCtx.progress > 0 && (
              <div style={{ width: 200 }}>
                <div className="ve-progress-bar-wrap" style={{ maxWidth: "100%" }}>
                  <div className="ve-progress-bar-fill" style={{ width: `${ffmpegCtx.progress * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export overlay */}
        {exporting && (
          <div className="ve-loading-overlay">
            <div className="ve-loading-spinner" />
            <div className="ve-loading-text">Exporting Video</div>
            <div className="ve-loading-sub">Processing locally · please keep this tab open</div>
            <div style={{ width: 220 }}>
              <div className="ve-progress-bar-wrap" style={{ maxWidth: "100%" }}>
                <div className="ve-progress-bar-fill" style={{ width: `${exportProgress * 100}%` }} />
              </div>
            </div>
            <div className="ve-loading-sub">{Math.round(exportProgress * 100)}%</div>
          </div>
        )}
      </div>
    </>
  );
}
