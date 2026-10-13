import { useRef } from "react";
import { useVisualizer } from "../hooks/useVisualizer";
import { usePersistentState } from "../../../../Utils/usePersistentState";
import styles from "../MusicPlayer.module.css";

// Click to switch off (saves CPU/battery; playback is untouched) or back on.
export default function Visualizer({ audioRef, isPlaying, visible = true }) {
  const canvasRef = useRef(null);
  const [enabled, setEnabled] = usePersistentState("tool:music_player:visualizer", true);
  useVisualizer(audioRef, canvasRef, isPlaying, visible, enabled);

  return (
    <div
      className={`${styles.visualizerWrap} ${enabled ? "" : styles.visualizerOff}`}
      onClick={() => setEnabled((v) => !v)}
      title={enabled ? "Click to turn the visualizer off" : "Click to turn the visualizer on"}
      role="button"
    >
      {enabled
        ? <canvas ref={canvasRef} className={styles.visualizerCanvas} />
        : <span>Visualizer off — click to turn on</span>}
    </div>
  );
}
