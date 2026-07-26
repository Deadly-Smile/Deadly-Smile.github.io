import { useRef, useState } from "react";
import { parseBlob } from "music-metadata-browser";
import { putTrack } from "../db/db";
import { isDuplicateUpload, stripExtension } from "../utils";
import styles from "../MusicPlayer.module.css";

const ACCEPTED_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg"];
const DURATION_LOAD_TIMEOUT_MS = 10000;

function loadAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      clearTimeout(timer);
    };
    const onLoaded = () => {
      const { duration } = audio;
      cleanup();
      resolve(duration);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not be read as audio"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out reading audio metadata"));
    }, DURATION_LOAD_TIMEOUT_MS);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = url;
  });
}

async function extractTags(file) {
  try {
    const metadata = await parseBlob(file);
    return { title: metadata.common.title || null, artist: metadata.common.artist || null };
  } catch {
    return { title: null, artist: null };
  }
}

export default function UploadButton({ existingTracks, onTrackAdded, onError }) {
  const inputRef = useRef(null);
  const [rejected, setRejected] = useState([]);
  const [uploading, setUploading] = useState(false);

  const dismissRejection = (index) => {
    setRejected((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    setUploading(true);
    const newRejections = [];
    let tracksSoFar = existingTracks;

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        newRejections.push({ name: file.name, reason: "Unsupported file type" });
        continue;
      }
      if (isDuplicateUpload(file, tracksSoFar)) {
        newRejections.push({ name: file.name, reason: "Duplicate of an existing track" });
        continue;
      }

      let duration;
      try {
        duration = await loadAudioDuration(file);
      } catch (e) {
        newRejections.push({ name: file.name, reason: e.message });
        continue;
      }

      const tags = await extractTags(file);
      const track = {
        id: crypto.randomUUID(),
        fileBlob: file,
        fileName: file.name,
        title: tags.title || stripExtension(file.name),
        artist: tags.artist,
        duration,
        dateAdded: Date.now(),
        albumId: null,
      };

      try {
        await putTrack(track);
      } catch (e) {
        onError?.(e.message);
        break; // stop processing remaining files; everything stored so far is kept
      }

      tracksSoFar = [...tracksSoFar, track];
      onTrackAdded(track);
    }

    if (newRejections.length) setRejected((prev) => [...prev, ...newRejections]);
    setUploading(false);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={styles.controlBtn}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Uploading…" : "+ Upload"}
      </button>
      {rejected.length > 0 && (
        <ul className={styles.rejectedList}>
          {rejected.map((r, i) => (
            <li key={`${r.name}-${i}`} className={styles.rejectedItem}>
              <span>{r.name}: {r.reason}</span>
              <button type="button" onClick={() => dismissRejection(i)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
