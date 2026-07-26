import { useEffect, useRef } from "react";

// Module-level singleton: ONE AudioContext/AnalyserNode reused across the whole
// tool, since createMediaElementSource() can only ever be called once per
// <audio> element and browsers cap the number of live AudioContexts.
let graph = null;

function getOrCreateGraph(audioEl) {
  if (!graph) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    graph = { ctx, analyser, source: null, connectedElement: null };
  }
  if (graph.connectedElement !== audioEl) {
    const source = graph.ctx.createMediaElementSource(audioEl);
    source.connect(graph.analyser);
    graph.analyser.connect(graph.ctx.destination);
    graph.source = source;
    graph.connectedElement = audioEl;
  }
  return graph;
}

export function closeAudioGraph() {
  if (graph) {
    graph.ctx.close().catch(() => {});
    graph = null;
  }
}

export function useVisualizer(audioRef, canvasRef, isPlaying) {
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
    if (g.ctx.state === "suspended") g.ctx.resume().catch(() => {});

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
  }, [isPlaying, audioRef, canvasRef]);
}
