import { createContext, useContext, useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// jsDelivr is used instead of unpkg because it sends the required
// Cross-Origin-Resource-Policy: cross-origin header that unpkg omits,
// which causes silent hangs in Chromium-based browsers.
const MT_BASE  = "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm";
const ST_BASE  = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

const FFmpegContext = createContext(null);

export function FFmpegProvider({ children }) {
  const [state, setState] = useState({
    ffmpeg:               null,
    ready:                false,
    loading:              false,
    progress:             0,
    error:                null,
    // true = multi-thread core loaded, false = fell back to single-thread
    multiThread:          false,
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    logs:                 [],
  });

  const ffmpegRef      = useRef(null);
  const loadingRef     = useRef(false);
  const loadPromiseRef = useRef(null);

  const tryLoad = useCallback(async (ff, base, isMultiThread) => {
    const [coreURL, wasmURL, workerURL] = await Promise.all([
      toBlobURL(`${base}/ffmpeg-core.js`,        "text/javascript"),
      toBlobURL(`${base}/ffmpeg-core.wasm`,       "application/wasm"),
      isMultiThread
        ? toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript")
        : Promise.resolve(undefined),
    ]);

    const loadArgs = isMultiThread
      ? { coreURL, wasmURL, workerURL }
      : { coreURL, wasmURL };

    // Race against a timeout — Chrome silently hangs on mt core without CORP headers
    await Promise.race([
      ff.load(loadArgs),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 15000)
      ),
    ]);
  }, []);

  const load = useCallback(async () => {
    if (ffmpegRef.current)                            return ffmpegRef.current;
    if (loadingRef.current && loadPromiseRef.current) return loadPromiseRef.current;

    loadingRef.current = true;
    setState(s => ({ ...s, loading: true, error: null }));

    loadPromiseRef.current = (async () => {
      try {
        const ff = new FFmpeg();
        ff.on("progress", ({ progress }) =>
          setState(s => ({ ...s, progress: Math.min(1, Math.max(0, progress)) }))
        );
        ff.on("log", ({ message }) =>
          setState(s => ({ ...s, logs: [...s.logs.slice(-50), message] }))
        );

        const canMultiThread = window.crossOriginIsolated &&
                               typeof SharedArrayBuffer !== "undefined";

        let multiThread = false;

        if (canMultiThread) {
          try {
            console.log("[FFmpeg] Trying multi-thread core...");
            await tryLoad(ff, MT_BASE, true);
            multiThread = true;
            console.log("[FFmpeg] Multi-thread core loaded ✓");
          } catch (e) {
            console.warn("[FFmpeg] Multi-thread failed, falling back to single-thread:", e.message);
            // Re-create FFmpeg instance — a failed load leaves it in a broken state
            const ff2 = new FFmpeg();
            ff2.on("progress", ({ progress }) =>
              setState(s => ({ ...s, progress: Math.min(1, Math.max(0, progress)) }))
            );
            ff2.on("log", ({ message }) =>
              setState(s => ({ ...s, logs: [...s.logs.slice(-50), message] }))
            );
            await tryLoad(ff2, ST_BASE, false);
            ffmpegRef.current = ff2;
            ff2._fetchFile = fetchFile;
            setState(s => ({ ...s, ffmpeg: ff2, ready: true, loading: false, multiThread: false }));
            return ff2;
          }
        } else {
          console.log("[FFmpeg] SharedArrayBuffer not available, using single-thread core...");
          await tryLoad(ff, ST_BASE, false);
        }

        ffmpegRef.current = ff;
        ff._fetchFile = fetchFile;
        setState(s => ({ ...s, ffmpeg: ff, ready: true, loading: false, multiThread }));
        return ff;
      } catch (err) {
        console.error("[FFmpeg] Load error:", err);
        loadingRef.current     = false;
        loadPromiseRef.current = null;
        setState(s => ({ ...s, loading: false, error: err.message }));
        throw err;
      }
    })();

    return loadPromiseRef.current;
  }, [tryLoad]);

  const getFetchFile = useCallback(() => {
    if (ffmpegRef.current?._fetchFile) return ffmpegRef.current._fetchFile;
    return async (file) => {
      if (file instanceof File || file instanceof Blob)
        return new Uint8Array(await file.arrayBuffer());
      throw new Error("fetchFile not available yet.");
    };
  }, []);

  return (
    <FFmpegContext.Provider value={{ ...state, load, getFetchFile }}>
      {children}
    </FFmpegContext.Provider>
  );
}

export function useFFmpeg() {
  return useContext(FFmpegContext);
}