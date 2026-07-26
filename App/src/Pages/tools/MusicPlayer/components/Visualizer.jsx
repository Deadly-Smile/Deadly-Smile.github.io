import { useRef } from "react";
import { useVisualizer } from "../hooks/useVisualizer";
import styles from "../MusicPlayer.module.css";

export default function Visualizer({ audioRef, isPlaying }) {
  const canvasRef = useRef(null);
  useVisualizer(audioRef, canvasRef, isPlaying);

  return (
    <div className={styles.visualizerWrap}>
      <canvas ref={canvasRef} width={800} height={90} className={styles.visualizerCanvas} />
    </div>
  );
}
