import { useEffect, useRef } from "react";

// Module-level singleton: ONE AudioContext/AnalyserNode reused across the whole
// tool, since createMediaElementSource() can only ever be called once per
// <audio> element and browsers cap the number of live AudioContexts.
//
// Two ways to feed the analyser:
// - "stream" (Chrome/Edge, incl. Android): analyse audio.captureStream(). The
//   <audio> element keeps playing to the speakers natively, so mobile browsers
//   treat it as ordinary media and keep it playing in the background / with
//   the screen locked. The analyser output goes to a muted gain node only so
//   the graph gets pulled.
// - "element" (Firefox/Safari, no unprefixed captureStream):
//   createMediaElementSource() reroutes the element's output through the
//   AudioContext. Playback then depends on the context running, which mobile
//   browsers suspend in the background — acceptable for desktop.
let graph = null;

function connectStreamSource(g) {
  const tracks = g.stream.getAudioTracks();
  if (tracks.length === 0) return; // nothing loaded yet; "addtrack" retries
  const key = tracks.map((t) => t.id).join(",");
  if (key === g.streamKey) return;
  g.source?.disconnect();
  g.source = g.ctx.createMediaStreamSource(new MediaStream(tracks));
  g.source.connect(g.analyser);
  g.streamKey = key;
}

function getOrCreateGraph(audioEl) {
  if (!graph) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512; // 256 bins — enough resolution for log-spaced bass bars
    graph = { ctx, analyser, source: null, connectedElement: null, stream: null, streamKey: null };
  }
  if (graph.connectedElement !== audioEl) {
    const g = graph;
    g.source?.disconnect();
    g.analyser.disconnect();
    if (typeof audioEl.captureStream === "function") {
      const mute = g.ctx.createGain();
      mute.gain.value = 0;
      g.analyser.connect(mute);
      mute.connect(g.ctx.destination);
      g.stream = audioEl.captureStream();
      g.streamKey = null;
      // Changing audio.src swaps the captured stream's tracks.
      const reconnect = () => { if (graph === g) connectStreamSource(g); };
      g.stream.addEventListener("addtrack", reconnect);
      audioEl.addEventListener("playing", reconnect); // backstop if addtrack doesn't fire
      connectStreamSource(g);
    } else {
      g.source = g.ctx.createMediaElementSource(audioEl);
      g.source.connect(g.analyser);
      g.analyser.connect(g.ctx.destination);
    }
    g.connectedElement = audioEl;
  }
  if (graph.stream) connectStreamSource(graph); // track may have changed while no listener ran
  return graph;
}

// Called synchronously from play(): resuming inside the play request (a click
// or a media-key / Media Session action) satisfies autoplay policy, whereas
// the effect below runs a render later and can be refused. In "element" mode
// a refused resume meant a media-key play produced silence — the context had
// been suspended on pause and audio is routed through it.
export function resumeAudioGraph() {
  if (graph?.ctx.state === "suspended") graph.ctx.resume().catch(() => {});
}

export function closeAudioGraph() {
  if (graph) {
    graph.ctx.close().catch(() => {});
    graph = null;
  }
}

// Colour runs blue (quiet / bar bottom) → cyan → green → yellow → red (loud /
// bar top). The same stops drive the canvas gradient for bars and a 256-step
// lookup table for the peak caps, so per-frame colour work is a table read.
const COLOR_STOPS = [
  [0, [37, 99, 235]],
  [0.3, [6, 182, 212]],
  [0.5, [34, 197, 94]],
  [0.75, [234, 179, 8]],
  [1, [239, 68, 68]],
];

function colorAt(t) {
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [p1, c1] = COLOR_STOPS[i];
    const [p0, c0] = COLOR_STOPS[i - 1];
    if (t <= p1) {
      const k = (t - p0) / (p1 - p0);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(",")})`;
    }
  }
  return `rgb(${COLOR_STOPS.at(-1)[1].join(",")})`;
}
const PEAK_COLORS = Array.from({ length: 256 }, (_, v) => colorAt(v / 255));

const FRAME_MS = 1000 / 30; // 30fps reads as smooth for bars, at a fraction of display-rate cost
const PEAK_FALL_PER_FRAME = 3; // in 0..255 units
const MAX_DPR = 2;

// Log-spaced bars: each bar covers a geometric slice of the spectrum, so the
// bass/mids that carry most music get most of the width instead of the
// near-empty top octave. Returns [startBin, endBin) per bar.
export function logBands(barCount, binCount, minBin = 1) {
  const maxBin = Math.floor(binCount * 0.75); // above ~16kHz is mostly silent
  const bands = [];
  let prevEnd = minBin;
  for (let i = 0; i < barCount; i++) {
    const end = Math.max(prevEnd + 1, Math.round(minBin * Math.pow(maxBin / minBin, (i + 1) / barCount)));
    bands.push([prevEnd, Math.min(end, binCount)]);
    prevEnd = end;
  }
  return bands;
}

// `visible` gates the draw loop. In "element" mode the AudioContext must still
// follow isPlaying while hidden: audio is routed through it, so leaving it
// suspended would silence playback started from the mini-player. In "stream"
// mode it only feeds the analyser, so it is suspended while hidden.
// `enabled: false` (visualizer switched off) behaves like hidden, and never
// builds the audio graph at all if it doesn't exist yet — playback then stays
// plain native <audio>.
export function useVisualizer(audioRef, canvasRef, isPlaying, visible = true, enabled = true) {
  const timerRef = useRef(null);

  useEffect(() => {
    const active = visible && enabled;
    if (!isPlaying) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (graph?.ctx.state === "running") {
        graph.ctx.suspend().catch(() => {});
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (!active && !graph) return;

    // AudioContext creation is user-gesture-gated: this effect only runs once
    // isPlaying flips true, i.e. after a Play click, satisfying autoplay policy.
    const g = getOrCreateGraph(audio);
    if (!active && g.stream) {
      g.ctx.suspend().catch(() => {});
      return;
    }
    if (g.ctx.state === "suspended") g.ctx.resume().catch(() => {});
    const canvas = canvasRef.current;
    if (!active || !canvas) return;

    const ctx2d = canvas.getContext("2d");
    const binCount = g.analyser.frequencyBinCount;
    const data = new Uint8Array(binCount);
    let bands = [], peaks = new Float32Array(0), gradient = null, barW = 0, gap = 0;

    // Backing store sized to the element's real pixels (sharp on HiDPI, no
    // wasted pixels on small screens); bar layout follows the width.
    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cssW = canvas.clientWidth || 800, cssH = canvas.clientHeight || 90;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const barCount = Math.max(24, Math.min(72, Math.floor(cssW / 14)));
      bands = logBands(barCount, binCount);
      peaks = new Float32Array(barCount);
      const slot = canvas.width / barCount;
      gap = Math.max(1, Math.round(slot * 0.2));
      barW = slot - gap;
      gradient = ctx2d.createLinearGradient(0, canvas.height, 0, 0);
      for (const [pos, c] of COLOR_STOPS) gradient.addColorStop(pos, `rgb(${c.join(",")})`);
    };
    layout();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(layout) : null;
    ro?.observe(canvas);

    // A fixed-rate timer rather than a requestAnimationFrame loop that skips
    // frames: a pending rAF makes the browser run its whole frame pipeline at
    // the display rate (60–144Hz) even on frames where nothing is drawn,
    // which measured as most of the visualizer's CPU. A canvas drawn from a
    // timer is composited on the next frame anyway. Timers are throttled in
    // background tabs, like rAF.
    let idle = false;
    const draw = () => {
      if (document.hidden) return;
      g.analyser.getByteFrequencyData(data);

      const { width, height } = canvas;
      let any = false;
      for (let i = 0; i < peaks.length; i++) if (peaks[i] > 0) { any = true; break; }
      if (!any) for (let i = 0; i < binCount; i++) if (data[i]) { any = true; break; }
      if (!any) {
        // Silence (gap between tracks, quiet intro): clear once, then skip.
        if (!idle) ctx2d.clearRect(0, 0, width, height);
        idle = true;
        return;
      }
      idle = false;

      ctx2d.clearRect(0, 0, width, height);
      ctx2d.fillStyle = gradient;
      const capH = Math.max(2, Math.round(height / 45));
      const levels = new Uint8Array(bands.length);
      for (let i = 0; i < bands.length; i++) {
        const [start, end] = bands[i];
        let v = 0;
        for (let b = start; b < end; b++) if (data[b] > v) v = data[b];
        levels[i] = v;
        const barH = (v / 255) * (height - capH);
        ctx2d.fillRect(i * (barW + gap), height - barH, barW, barH);
      }
      for (let i = 0; i < bands.length; i++) {
        peaks[i] = Math.max(levels[i], peaks[i] - PEAK_FALL_PER_FRAME);
        if (peaks[i] < 1) { peaks[i] = 0; continue; }
        const p = peaks[i] | 0;
        ctx2d.fillStyle = PEAK_COLORS[p];
        ctx2d.fillRect(i * (barW + gap), height - capH - (p / 255) * (height - capH), barW, capH);
      }
    };
    timerRef.current = setInterval(draw, FRAME_MS);

    return () => {
      ro?.disconnect();
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying, visible, enabled, audioRef, canvasRef]);
}
