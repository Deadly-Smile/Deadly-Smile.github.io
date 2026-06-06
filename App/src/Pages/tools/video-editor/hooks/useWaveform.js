import { useEffect } from "react";

// Decodes an audio/video file and renders its waveform into the given canvas ref.
export function useWaveform(file, canvasRef) {
  useEffect(() => {
    if (!file || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const ctx     = new (window.AudioContext || window.webkitAudioContext)();
        const buf     = await file.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf);
        if (cancelled) return;
        const data   = decoded.getChannelData(0);
        const canvas = canvasRef.current;
        const W = canvas.width, H = canvas.height;
        const c2d = canvas.getContext("2d");
        c2d.clearRect(0, 0, W, H);
        const step = Math.ceil(data.length / W);
        c2d.strokeStyle = "rgba(232,103,42,0.6)";
        c2d.lineWidth = 1;
        for (let x = 0; x < W; x++) {
          let min = 1, max = -1;
          for (let j = 0; j < step; j++) { const d = data[x * step + j] || 0; if (d < min) min = d; if (d > max) max = d; }
          c2d.beginPath(); c2d.moveTo(x, (1 - max) * H / 2); c2d.lineTo(x, (1 - min) * H / 2); c2d.stroke();
        }
        ctx.close();
      } catch (_) { /* ignore decode failures (e.g. video with no audio) */ }
    })();
    return () => { cancelled = true; };
  }, [file, canvasRef]);
}
