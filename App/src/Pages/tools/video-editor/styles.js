export const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Barlow:wght@400;500;600&display=swap');

  :root {
    --ve-bg:          #0d0d0e;
    --ve-surface:     #141416;
    --ve-surface2:    #1c1c1f;
    --ve-surface3:    #252529;
    --ve-border:      #2a2a2f;
    --ve-border2:     #3a3a40;
    --ve-accent:      #e8672a;
    --ve-accent2:     #f0954d;
    --ve-accent-dim:  rgba(232,103,42,0.18);
    --ve-text:        #e8e8ec;
    --ve-text2:       #9898a8;
    --ve-text3:       #5a5a68;
    --ve-danger:      #e84242;
    --ve-success:     #42c97a;
    --ve-mono:        'JetBrains Mono', monospace;
    --ve-sans:        'Barlow', sans-serif;
    --ve-radius:      4px;
    --ve-radius-lg:   8px;
    --ve-timeline-h:  72px;
    --ve-handle-w:    10px;
  }

  .ve-root * { box-sizing: border-box; margin: 0; padding: 0; }

  .ve-root {
    font-family: var(--ve-sans);
    background: var(--ve-bg);
    color: var(--ve-text);
    height: 100vh;
    display: grid;
    grid-template-rows: 44px 1fr auto 44px;
    grid-template-columns: 1fr;
    overflow: hidden;
    user-select: none;
    -webkit-font-smoothing: antialiased;
  }

  .ve-topbar {
    grid-row: 1;
    background: var(--ve-surface);
    border-bottom: 1px solid var(--ve-border);
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    z-index: 20;
  }
  .ve-topbar-brand {
    font-family: var(--ve-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ve-accent);
    margin-right: 8px;
    padding-right: 12px;
    border-right: 1px solid var(--ve-border);
  }
  .ve-topbar-spacer { flex: 1; }
  .ve-btn {
    font-family: var(--ve-sans);
    font-size: 12px;
    font-weight: 500;
    padding: 5px 12px;
    border: 1px solid var(--ve-border2);
    border-radius: var(--ve-radius);
    background: var(--ve-surface2);
    color: var(--ve-text);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .ve-btn:hover { border-color: var(--ve-accent); background: var(--ve-surface3); }
  .ve-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .ve-btn-primary { background: var(--ve-accent); border-color: var(--ve-accent); color: #fff; }
  .ve-btn-primary:hover { background: var(--ve-accent2); border-color: var(--ve-accent2); }
  .ve-btn-danger { border-color: var(--ve-danger); color: var(--ve-danger); }
  .ve-btn-danger:hover { background: rgba(232,66,66,0.12); }

  .ve-badge {
    font-family: var(--ve-mono);
    font-size: 10px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 2px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .ve-badge-ok   { background: rgba(66,201,122,0.15); color: var(--ve-success); border: 1px solid rgba(66,201,122,0.3); }
  .ve-badge-warn { background: rgba(240,149,77,0.15); color: var(--ve-accent2); border: 1px solid rgba(240,149,77,0.3); }
  .ve-badge-err  { background: rgba(232,66,66,0.15);  color: var(--ve-danger);  border: 1px solid rgba(232,66,66,0.3); }

  .ve-workspace {
    grid-row: 2;
    display: grid;
    grid-template-columns: 1fr 280px;
    overflow: hidden;
  }

  .ve-preview {
    position: relative;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-right: 1px solid var(--ve-border);
  }
  .ve-preview video { max-width: 100%; max-height: 100%; display: block; }
  .ve-drop-zone {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 16px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .ve-drop-zone.dragging { background: rgba(232,103,42,0.08); }
  .ve-drop-zone input { display: none; }
  .ve-drop-label {
    font-family: var(--ve-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ve-text3);
  }
  .ve-drop-icon {
    width: 56px; height: 56px;
    border: 1.5px solid var(--ve-border2);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: var(--ve-text3);
    transition: border-color 0.15s, color 0.15s;
  }
  .ve-drop-zone:hover .ve-drop-icon,
  .ve-drop-zone.dragging .ve-drop-icon { border-color: var(--ve-accent); color: var(--ve-accent); }

  /* FIX: drag overlay when video is loaded */
  .ve-drag-overlay {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(232,103,42,0.18);
    border: 2px dashed var(--ve-accent);
    z-index: 10;
    pointer-events: none;
  }
  .ve-drag-overlay span {
    font-family: var(--ve-mono);
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ve-accent);
    background: rgba(13,13,14,0.8);
    padding: 8px 16px;
    border-radius: var(--ve-radius);
  }

  .ve-text-overlay { position: absolute; pointer-events: none; }
  .ve-text-overlay-item {
    position: absolute;
    font-weight: bold;
    text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
    white-space: pre;
  }

  .ve-controls { display: flex; flex-direction: column; overflow: hidden; background: var(--ve-surface); }
  .ve-tabs {
    display: flex;
    border-bottom: 1px solid var(--ve-border);
    flex-shrink: 0;
    overflow-x: auto;
  }
  .ve-tabs::-webkit-scrollbar { height: 0; }
  .ve-tab {
    font-family: var(--ve-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 10px 14px;
    cursor: pointer;
    color: var(--ve-text3);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    background: none;
    border-top: none; border-left: none; border-right: none;
  }
  .ve-tab:hover { color: var(--ve-text2); }
  .ve-tab.active { color: var(--ve-accent); border-bottom-color: var(--ve-accent); }
  .ve-panel {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--ve-border2) transparent;
  }
  .ve-panel::-webkit-scrollbar { width: 4px; }
  .ve-panel::-webkit-scrollbar-track { background: transparent; }
  .ve-panel::-webkit-scrollbar-thumb { background: var(--ve-border2); border-radius: 2px; }

  .ve-field { margin-bottom: 14px; }
  .ve-label {
    display: block;
    font-family: var(--ve-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ve-text3);
    margin-bottom: 6px;
  }
  .ve-label span { float: right; font-weight: 400; color: var(--ve-text2); }
  .ve-slider {
    -webkit-appearance: none;
    width: 100%; height: 3px;
    background: var(--ve-border2);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .ve-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 13px; height: 13px;
    border-radius: 50%;
    background: var(--ve-accent);
    cursor: pointer;
    border: 2px solid var(--ve-surface);
    transition: transform 0.1s;
  }
  .ve-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
  .ve-input {
    width: 100%;
    background: var(--ve-surface2);
    border: 1px solid var(--ve-border2);
    border-radius: var(--ve-radius);
    color: var(--ve-text);
    font-family: var(--ve-sans);
    font-size: 13px;
    padding: 7px 10px;
    outline: none;
    transition: border-color 0.15s;
  }
  .ve-input:focus { border-color: var(--ve-accent); }
  .ve-select {
    width: 100%;
    background: var(--ve-surface2);
    border: 1px solid var(--ve-border2);
    border-radius: var(--ve-radius);
    color: var(--ve-text);
    font-family: var(--ve-sans);
    font-size: 13px;
    padding: 7px 10px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .ve-select:focus { border-color: var(--ve-accent); }
  .ve-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: var(--ve-text2); }
  .ve-toggle-switch {
    width: 32px; height: 18px;
    border-radius: 9px;
    background: var(--ve-border2);
    position: relative;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .ve-toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px; left: 2px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--ve-text3);
    transition: transform 0.2s, background 0.2s;
  }
  .ve-toggle input:checked ~ .ve-toggle-switch { background: var(--ve-accent); }
  .ve-toggle input:checked ~ .ve-toggle-switch::after { transform: translateX(14px); background: #fff; }
  .ve-toggle input { display: none; }
  .ve-row { display: flex; gap: 8px; align-items: center; }
  .ve-section-title {
    font-family: var(--ve-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ve-text3);
    margin: 18px 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--ve-border);
  }
  .ve-section-title:first-child { margin-top: 0; }
  .ve-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ve-meta-item {
    background: var(--ve-surface2);
    border: 1px solid var(--ve-border);
    border-radius: var(--ve-radius);
    padding: 8px 10px;
  }
  .ve-meta-item .ve-meta-key {
    font-family: var(--ve-mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ve-text3);
    margin-bottom: 2px;
  }
  .ve-meta-item .ve-meta-val { font-family: var(--ve-mono); font-size: 12px; font-weight: 500; color: var(--ve-text); }
  .ve-text-layer-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .ve-text-layer-row {
    background: var(--ve-surface2);
    border: 1px solid var(--ve-border);
    border-radius: var(--ve-radius);
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .ve-text-layer-row span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ve-text2); }
  .ve-color-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .ve-color-chip { width: 24px; height: 24px; border-radius: 3px; cursor: pointer; border: 2px solid transparent; transition: border-color 0.1s; }
  .ve-color-chip.selected { border-color: var(--ve-accent); }
  .ve-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .ve-filter-chip {
    padding: 8px;
    background: var(--ve-surface2);
    border: 1px solid var(--ve-border);
    border-radius: var(--ve-radius);
    cursor: pointer;
    font-size: 12px;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
    color: var(--ve-text2);
  }
  .ve-filter-chip:hover { border-color: var(--ve-border2); color: var(--ve-text); }
  .ve-filter-chip.active { border-color: var(--ve-accent); color: var(--ve-accent); background: var(--ve-accent-dim); }
  .ve-export-preset {
    padding: 10px 12px;
    background: var(--ve-surface2);
    border: 1px solid var(--ve-border);
    border-radius: var(--ve-radius);
    cursor: pointer;
    margin-bottom: 6px;
    transition: border-color 0.15s;
  }
  .ve-export-preset:hover { border-color: var(--ve-border2); }
  .ve-export-preset.selected { border-color: var(--ve-accent); background: var(--ve-accent-dim); }
  .ve-export-preset-name { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
  .ve-export-preset-desc { font-size: 11px; color: var(--ve-text3); }

  /* Audio layer styles */
  .ve-audio-layer-row {
    background: var(--ve-surface2);
    border: 1px solid var(--ve-border);
    border-radius: var(--ve-radius);
    padding: 8px 10px;
    margin-bottom: 6px;
  }
  .ve-audio-layer-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .ve-audio-layer-name { flex: 1; font-size: 12px; color: var(--ve-text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ve-audio-layer-times { font-family: var(--ve-mono); font-size: 10px; color: var(--ve-text3); }

  /* Audio timeline indicator */
  .ve-audio-track-bar {
    height: 8px;
    background: rgba(232,103,42,0.35);
    border: 1px solid var(--ve-accent);
    border-radius: 2px;
    position: absolute;
    top: 22px;
  }

  .ve-timeline-area {
    grid-row: 3;
    background: var(--ve-surface);
    border-top: 1px solid var(--ve-border);
    display: flex;
    flex-direction: column;
    height: 130px;
    flex-shrink: 0;
  }
  .ve-timeline-controls {
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 10px;
    height: 36px;
    border-bottom: 1px solid var(--ve-border);
    flex-shrink: 0;
  }
  .ve-time-display {
    font-family: var(--ve-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--ve-text);
    letter-spacing: 0.04em;
    min-width: 100px;
  }
  .ve-play-btn {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--ve-accent);
    border: none;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    transition: background 0.15s, transform 0.1s;
    flex-shrink: 0;
  }
  .ve-play-btn:hover { background: var(--ve-accent2); transform: scale(1.05); }
  .ve-play-btn:disabled { background: var(--ve-border2); cursor: not-allowed; transform: none; }
  .ve-timeline-wrap { flex: 1; position: relative; overflow: hidden; cursor: pointer; }
  .ve-timeline-track { position: absolute; inset: 0; background: var(--ve-surface2); }
  .ve-timeline-ruler { position: absolute; top: 0; left: 0; right: 0; height: 18px; pointer-events: none; }
  .ve-timeline-tick { position: absolute; bottom: 0; width: 1px; background: var(--ve-border2); }
  .ve-timeline-tick-label {
    position: absolute;
    font-family: var(--ve-mono);
    font-size: 9px;
    color: var(--ve-text3);
    letter-spacing: 0.04em;
    transform: translateX(-50%);
    top: 1px;
  }
  .ve-timeline-selection {
    position: absolute; top: 0; bottom: 0;
    background: rgba(232,103,42,0.15);
    border-left: 2px solid var(--ve-accent);
    border-right: 2px solid var(--ve-accent);
    pointer-events: none;
  }
  .ve-timeline-handle {
    position: absolute; top: 0; bottom: 0;
    width: var(--ve-handle-w);
    background: var(--ve-accent);
    cursor: ew-resize;
    z-index: 5;
  }
  .ve-timeline-handle::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 2px; height: 16px;
    background: rgba(255,255,255,0.5);
    border-radius: 1px;
  }
  .ve-timeline-handle.in { transform: translateX(-100%); }
  .ve-playhead { position: absolute; top: 0; bottom: 0; width: 1px; background: #fff; pointer-events: none; z-index: 10; }
  .ve-playhead::before {
    content: '';
    position: absolute; top: 0; left: -4px;
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 7px solid #fff;
  }
  .ve-waveform { position: absolute; top: 18px; left: 0; right: 0; bottom: 0; pointer-events: none; }

  .ve-statusbar {
    grid-row: 4;
    background: var(--ve-surface);
    border-top: 1px solid var(--ve-border);
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 12px;
    font-family: var(--ve-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .ve-status-item { display: flex; align-items: center; gap: 6px; color: var(--ve-text3); }
  .ve-progress-bar-wrap { flex: 1; height: 3px; background: var(--ve-border); border-radius: 2px; overflow: hidden; max-width: 200px; }
  .ve-progress-bar-fill { height: 100%; background: var(--ve-accent); border-radius: 2px; transition: width 0.1s linear; }
  .ve-error-msg { color: var(--ve-danger); font-size: 10px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .ve-loading-overlay {
    position: fixed; inset: 0;
    background: rgba(13,13,14,0.92);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 20px; z-index: 100;
  }
  .ve-loading-spinner {
    width: 40px; height: 40px;
    border: 2px solid var(--ve-border2);
    border-top-color: var(--ve-accent);
    border-radius: 50%;
    animation: ve-spin 0.8s linear infinite;
  }
  @keyframes ve-spin { to { transform: rotate(360deg); } }
  .ve-loading-text { font-family: var(--ve-mono); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ve-text2); }
  .ve-loading-sub { font-family: var(--ve-mono); font-size: 10px; color: var(--ve-text3); letter-spacing: 0.06em; }

  /* Snapshot strip */
  .ve-snapshot-strip {
    display: flex; gap: 4px; flex-wrap: wrap;
    margin-top: 8px;
  }
  .ve-snapshot-thumb {
    position: relative;
    width: 72px; height: 48px;
    border-radius: var(--ve-radius);
    overflow: hidden;
    border: 1px solid var(--ve-border);
    cursor: pointer;
    flex-shrink: 0;
  }
  .ve-snapshot-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .ve-snapshot-thumb .ve-snapshot-del {
    position: absolute; top: 2px; right: 2px;
    background: rgba(13,13,14,0.7);
    border: none; cursor: pointer;
    color: var(--ve-danger);
    font-size: 11px; line-height: 1;
    padding: 1px 4px;
    border-radius: 2px;
    display: none;
  }
  .ve-snapshot-thumb:hover .ve-snapshot-del { display: block; }
`;
