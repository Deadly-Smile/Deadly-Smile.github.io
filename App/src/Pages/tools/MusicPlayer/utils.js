export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function stripExtension(fileName) {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

export function fisherYatesShuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function resolveTracks(trackIds, tracksById) {
  return trackIds.filter((id) => tracksById.has(id)).map((id) => tracksById.get(id));
}

export function isDuplicateUpload(file, existingTracks) {
  return existingTracks.some(
    (t) => t.fileName === file.name && t.fileBlob?.size === file.size
  );
}
