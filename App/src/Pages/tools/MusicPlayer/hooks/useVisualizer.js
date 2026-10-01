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
    analyser.fftSize = 256;
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

export function closeAudioGraph() {
  if (graph) {
    graph.ctx.close().catch(() => {});
    graph = null;
  }
}

// `visible` gates the draw loop. In "element" mode the AudioContext must still
// follow isPlaying while hidden: audio is routed through it, so leaving it
// suspended would silence playback started from the mini-player. In "stream"
// mode it only feeds the analyser, so it is suspended while hidden.
export function useVisualizer(audioRef, canvasRef, isPlaying, visible = true) {
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (graph?.ctx.state === "running") {
        graph.ctx.suspend().catch(() => {});
      }
      return;
    }

    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    // AudioContext creation is user-gesture-gated: this effect only runs once
    // isPlaying flips true, i.e. after a Play click, satisfying autoplay policy.
    const g = getOrCreateGraph(audio);
    if (!visible && g.stream) {
      g.ctx.suspend().catch(() => {});
      return;
    }
    if (g.ctx.state === "suspended") g.ctx.resume().catch(() => {});
    if (!visible) return;

    const ctx2d = canvas.getContext("2d");
    const bufferLength = g.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barColor = getComputedStyle(document.documentElement).getPropertyValue("--tk-accent").trim() || "#00ff88";

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      g.analyser.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx2d.clearRect(0, 0, width, height);
      ctx2d.fillStyle = barColor;

      const barWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        ctx2d.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    draw();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, visible, audioRef, canvasRef]);
}
