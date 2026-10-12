import { useEffect, useRef, useState } from "react";
import { BackgroundDock } from "../../../../Utils/KeepAlive";
import { usePersistentState } from "../../../../Utils/usePersistentState";
import styles from "../MusicPlayer.module.css";

const EDGE_MARGIN = 8;

function clampToViewport(pos, el) {
  if (!pos) return null;
  const w = el?.offsetWidth ?? 0;
  const h = el?.offsetHeight ?? 0;
  return {
    x: Math.round(Math.min(Math.max(EDGE_MARGIN, pos.x), Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN))),
    y: Math.round(Math.min(Math.max(EDGE_MARGIN, pos.y), Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN))),
  };
}

// Floating "now playing" chip shown while the Music Player is kept alive in
// the background (see Utils/KeepAlive.jsx). It sits in the shared bottom-left
// dock until dragged by its grip; then it floats at the dropped position
// (remembered across visits). Double-clicking the grip docks it again.
export default function MiniPlayer({ track, isPlaying, onTogglePlay, onNext, onPrevious, onOpen, onClose }) {
  const [savedPos, setSavedPos] = usePersistentState("tool:music_player:mini-pos", null);
  const [dragPos, setDragPos] = useState(null);
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [, setViewportTick] = useState(0);

  // Keep a floated player on screen when the window shrinks.
  useEffect(() => {
    if (!savedPos) return;
    const onResize = () => setViewportTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [savedPos]);

  const onGripDown = (e) => {
    if (e.button !== 0) return;
    const rect = rootRef.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragPos({ x: rect.left, y: rect.top });
  };
  const onGripMove = (e) => {
    if (!dragRef.current) return;
    setDragPos(clampToViewport({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy }, rootRef.current));
  };
  const onGripUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (dragPos) setSavedPos(dragPos);
    setDragPos(null);
  };

  const pos = dragPos ?? clampToViewport(savedPos, rootRef.current);
  const floatingStyle = pos ? { position: "fixed", left: pos.x, top: pos.y } : undefined;

  return (
    <BackgroundDock>
      <div
        ref={rootRef}
        className={`${styles.miniPlayer} ${dragPos ? styles.miniPlayerDragging : ""}`}
        style={floatingStyle}
        role="region"
        aria-label="Music Player"
      >
        <span
          className={styles.miniGrip}
          title={savedPos ? "Drag to move · double-click to dock" : "Drag to move"}
          aria-hidden="true"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          onDoubleClick={() => setSavedPos(null)}
        >
          ⠿
        </span>
        <button type="button" className={styles.miniTitle} onClick={onOpen} title="Open Music Player">
          <span aria-hidden="true">🎵</span>
          <span className={styles.miniTitleText}>{track.title}</span>
        </button>
        <button type="button" className={styles.miniBtn} onClick={onPrevious} title="Previous (Alt+Shift+B)">⏮</button>
        <button type="button" className={styles.miniBtn} onClick={onTogglePlay} title={`${isPlaying ? "Pause" : "Play"} (Alt+Shift+P)`}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button type="button" className={styles.miniBtn} onClick={onNext} title="Next (Alt+Shift+N)">⏭</button>
        <button type="button" className={styles.miniBtn} onClick={onClose} title="Stop and close">✕</button>
      </div>
    </BackgroundDock>
  );
}
