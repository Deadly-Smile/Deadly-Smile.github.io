// ── tk-shared.jsx — Shared UI primitives for all toolkit tools ────────────────
import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";

const GOOGLE_STUN = [{ urls: "stun:stun.l.google.com:19302" }];

// Fetches TURN credentials from the Vercel serverless endpoint, falling back
// to Google's public STUN server on any failure so P2P features degrade
// gracefully instead of breaking. Shared by every WebRTC-based tool.
export async function getIceServers() {
  try {
    const res = await fetch("/api/turn-credentials");
    const { iceServers, fallback } = await res.json();
    if (fallback) console.warn("TURN unavailable, using Google STUN fallback.");
    return iceServers;
  } catch {
    return GOOGLE_STUN;
  }
}

// Camera + jsQR decode loop. Stops itself the moment a code is found — the
// caller decides what happens next (usually swaps this out of the tree).
export function QrScanner({ onDecode, onCancel }) {
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
    <div className="tk-qr-scanner">
      {error ? (
        <p className="tk-error">{error}</p>
      ) : (
        <video ref={videoRef} className="tk-qr-scanner-video" playsInline muted />
      )}
      {onCancel && <button className="tk-action-btn" onClick={onCancel}>Cancel</button>}
    </div>
  );
}

export function CopyBtn({ getText, label = "Copy" }) {
  const [s, setS] = useState("idle");
  const go = () => {
    const t = typeof getText === "function" ? getText() : getText;
    if (!t || t === "—") return;
    navigator.clipboard.writeText(t)
      .then(() => { setS("ok");  setTimeout(() => setS("idle"), 1400); })
      .catch(() => { setS("err"); setTimeout(() => setS("idle"), 1400); });
  };
  return (
    <button className="tk-action-btn" onClick={go}>
      {s === "ok" ? "✓ Copied!" : s === "err" ? "✗ Failed" : label}
    </button>
  );
}

export function CopySmall({ getText }) {
  const [s, setS] = useState("idle");
  const go = () => {
    const t = typeof getText === "function" ? getText() : getText;
    if (!t || t === "—") return;
    navigator.clipboard.writeText(t)
      .then(() => { setS("ok");  setTimeout(() => setS("idle"), 1400); })
      .catch(() => { setS("err"); setTimeout(() => setS("idle"), 1400); });
  };
  return (
    <button className="tk-copy-small" onClick={go}>
      {s === "ok" ? "✓" : s === "err" ? "✗" : "copy"}
    </button>
  );
}

export function ActionBtn({ onClick, danger, disabled, children, style }) {
  return (
    <button
      className={`tk-action-btn${danger ? " tk-danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

export function StatusBar({ msg, type }) {
  return (
    <div className={`tk-status-bar${type ? " tk-" + type : ""}`}>
      {msg}
    </div>
  );
}

export function SplitPane({ left, right }) {
  return (
    <div className="tk-split-pane">
      <div className="tk-pane">{left}</div>
      <div className="tk-pane">{right}</div>
    </div>
  );
}

export function PaneLabel({ children }) {
  return <div className="tk-pane-label">{children}</div>;
}
