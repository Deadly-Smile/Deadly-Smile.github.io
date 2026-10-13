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

// Browsers and OSes label the same format differently (audio/x-wav,
// audio/vnd.wave, audio/x-m4a, audio/mp4, audio/x-flac…) or leave file.type
// empty, so a file is recognised by its MIME type OR its extension. Whether
// this browser can actually decode it is settled afterwards, by loading it
// into an <audio> element.
const EXTENSION_MIME = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  webm: "audio/webm",
};
export const AUDIO_EXTENSIONS = Object.keys(EXTENSION_MIME);

function extensionOf(fileName) {
  const idx = (fileName || "").lastIndexOf(".");
  return idx > 0 ? fileName.slice(idx + 1).toLowerCase() : "";
}

function baseMime(type) {
  return (type || "").toLowerCase().split(";")[0].trim();
}

export function isSupportedAudioFile(file) {
  return baseMime(file.type).startsWith("audio/") || extensionOf(file.name) in EXTENSION_MIME;
}

// The MIME type to store with the track: the file's own audio type when it
// has one, otherwise a guess from the extension (an empty type would also
// travel to other devices through P2P sync).
export function audioMimeFor(file) {
  const type = baseMime(file.type);
  if (type.startsWith("audio/")) return file.type;
  return EXTENSION_MIME[extensionOf(file.name)] || file.type;
}

// For the file picker's `accept` attribute.
export const AUDIO_ACCEPT = ["audio/*", ...AUDIO_EXTENSIONS.map((e) => `.${e}`)].join(",");
