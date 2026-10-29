// Chunked file transfer over a PeerJS DataConnection.

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const CHUNK_SIZE = 16 * 1024;
export const MAX_CHUNKS = Math.ceil(MAX_FILE_SIZE / CHUNK_SIZE);

export function concatArrayBuffers(buffers) {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

// Splits the file into small chunks so the transfer has visible progress instead
// of appearing to complete instantly, yielding between chunks so the UI can repaint.
// Stops early (returns false) if the connection closes mid-transfer.
export async function sendFileChunked(conn, file, id, onProgress) {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  conn.send({ type: "file-start", id, name: file.name, mime: file.type, size: file.size, totalChunks });
  for (let i = 0; i < totalChunks; i++) {
    if (!conn.open) return false;
    const start = i * CHUNK_SIZE;
    const buf = await file.slice(start, start + CHUNK_SIZE).arrayBuffer();
    conn.send({ type: "file-chunk", id, index: i, data: buf });
    onProgress((i + 1) / totalChunks);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return true;
}

// Validates a peer's "file-start"; null if malformed or over the size cap
// (the receiver allocates totalChunks slots up front).
export function parseFileStart(data) {
  const { id, name, mime, size, totalChunks } = data ?? {};
  if (typeof id !== "string" || id.length > 64) return null;
  if (typeof name !== "string" || !name) return null;
  if (!Number.isInteger(size) || size < 0 || size > MAX_FILE_SIZE) return null;
  if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) return null;
  return { id, name: name.slice(0, 255), mime: typeof mime === "string" ? mime.slice(0, 100) : "", size, totalChunks };
}
