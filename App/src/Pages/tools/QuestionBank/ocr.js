import { createWorker } from "tesseract.js";

// Bangla + English combined so the app doesn't have to guess the source
// language before OCR runs — see ticket Section 6a.
const LANGS = "ben+eng";

// Batch processing (Phase 3) creates one worker and reuses it across every
// image in the queue — recreating a worker per image would re-download/
// re-init the Bangla trained data each time.
export async function createOcrWorker(onProgress) {
  return createWorker(LANGS, undefined, {
    logger: (m) => {
      if (onProgress && m.status === "recognizing text") onProgress(m.progress);
    },
  });
}

export async function recognizeImage(worker, file) {
  const { data } = await worker.recognize(file);
  return { text: data.text, confidence: data.confidence };
}

export async function terminateOcrWorker(worker) {
  await worker?.terminate();
}

// Large phone-camera photos slow OCR down for no accuracy benefit past a
// point — downscale before recognizing if either dimension is oversized.
export async function downscaleImage(file, maxDimension = 1600) {
  if (!file.type?.startsWith("image/") || file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1) {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ?? file;
}

// Convenience path for a single one-off image (Phase 2) — owns its own
// worker lifecycle so callers don't need to think about create/terminate.
export async function ocrSingleImage(file, onProgress) {
  const worker = await createOcrWorker(onProgress);
  try {
    return await recognizeImage(worker, file);
  } finally {
    await terminateOcrWorker(worker);
  }
}
