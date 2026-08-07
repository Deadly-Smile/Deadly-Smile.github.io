import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// Camera + jsQR decode loop. Stops itself the moment a code is found — the
// caller decides what happens next (usually swaps this out of the tree).
export default function QrScanner({ onDecode, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const onDecodeRef = useRef(onDecode);
  const [error, setError] = useState("");

  useEffect(() => { onDecodeRef.current = onDecode; }, [onDecode]);

  useEffect(() => {
    let cancelled = false;
    canvasRef.current = document.createElement("canvas");

    function tick() {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          onDecodeRef.current(code.data);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        tick();
      } catch (err) {
        setError(err.name === "NotAllowedError" ? "Camera access denied." : err.message);
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="tk-qb-scanner">
      {error ? (
        <p className="tk-error">{error}</p>
      ) : (
        <video ref={videoRef} className="tk-qb-scanner-video" playsInline muted />
      )}
      {onCancel && <button className="tk-action-btn" onClick={onCancel}>Cancel</button>}
    </div>
  );
}
