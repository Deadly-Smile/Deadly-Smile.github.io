import { useRef } from "react";
import AlbumCoverImage from "./AlbumCoverImage";
import styles from "../MusicPlayer.module.css";

export default function AlbumCoverPicker({ value, onChange }) {
  const inputRef = useRef(null);

  return (
    <div className={styles.coverPicker}>
      <AlbumCoverImage blob={value} className={styles.coverPreview} placeholderClassName={styles.coverPlaceholder} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file);
          e.target.value = "";
        }}
      />
      <button type="button" className={styles.controlBtn} onClick={() => inputRef.current?.click()}>
        {value ? "Change Cover" : "Add Cover"}
      </button>
    </div>
  );
}
