import { useRef, useCallback } from "react";
import { clamp, formatTime } from "../utils/format";
import { useWaveform } from "../hooks/useWaveform";

export function Timeline({ duration, currentTime, inPoint, outPoint, onSeek, onInChange, onOutChange, sourceFile, audioLayers }) {
  const trackRef   = useRef(null);
  const waveCanRef = useRef(null);
  const dragging   = useRef(null);

  useWaveform(sourceFile, waveCanRef);

  const xToTime = useCallback((clientX) => {
    if (!trackRef.current || !duration) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
  }, [duration]);

  const handlePointerDown = (e, type) => {
    e.preventDefault(); e.stopPropagation();
    dragging.current = type;
    trackRef.current?.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const t = xToTime(e.clientX);
    if (dragging.current === "in")  onInChange(clamp(t, 0, outPoint - 0.1));
    else if (dragging.current === "out") onOutChange(clamp(t, inPoint + 0.1, duration));
    else onSeek(t);
  }, [xToTime, onSeek, onInChange, onOutChange, inPoint, outPoint, duration]);
  const handlePointerUp = () => { dragging.current = null; };
  const handleTrackClick = (e) => { if (!dragging.current) onSeek(xToTime(e.clientX)); };

  const ticks = [];
  if (duration > 0) {
    const step = duration <= 30 ? 5 : duration <= 120 ? 10 : duration <= 600 ? 30 : 60;
    for (let t = 0; t <= duration; t += step) ticks.push({ t, x: (t / duration) * 100 });
  }

  const playheadX = duration ? (currentTime / duration) * 100 : 0;
  const inX       = duration ? (inPoint / duration) * 100 : 0;
  const outX      = duration ? (outPoint / duration) * 100 : 100;

  return (
    <div className="ve-timeline-wrap" ref={trackRef}
      onClick={handleTrackClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="ve-timeline-track">
        <canvas ref={waveCanRef} className="ve-waveform" width={1200} height={54} style={{ width: "100%", height: "100%" }} />
        <div className="ve-timeline-ruler">
          {ticks.map(({ t, x }) => (
            <span key={t} style={{ position: "absolute", left: `${x}%` }}>
              <span className="ve-timeline-tick-label">{formatTime(t)}</span>
              <span className="ve-timeline-tick" style={{ height: 8 }} />
            </span>
          ))}
        </div>
        {/* Audio layer bars on timeline */}
        {duration > 0 && audioLayers.map((layer, i) => (
          <div key={layer.id} className="ve-audio-track-bar"
            style={{
              left:  `${(layer.startTime / duration) * 100}%`,
              width: `${((layer.endTime - layer.startTime) / duration) * 100}%`,
              top:   `${30 + i * 10}px`,
            }}
            title={layer.label}
          />
        ))}
        <div className="ve-timeline-selection" style={{ left: `${inX}%`, width: `${outX - inX}%` }} />
        <div className="ve-timeline-handle in" style={{ left: `${inX}%` }} onPointerDown={e => handlePointerDown(e, "in")} />
        <div className="ve-timeline-handle"    style={{ left: `${outX}%` }} onPointerDown={e => handlePointerDown(e, "out")} />
        <div className="ve-playhead" style={{ left: `${playheadX}%` }} />
      </div>
    </div>
  );
}
