// ── tk-shared.jsx — Shared UI primitives for all toolkit tools ────────────────
import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import Peer from "peerjs";

// Used when /api/turn-credentials is unreachable or not configured (e.g. local dev).
// Multiple STUN servers add redundancy, but STUN alone can't traverse symmetric NAT
// or firewalls that block UDP outright — so a public TURN relay (with a TCP/443
// option) is included too, otherwise those networks simply can't connect at all.
const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

// Fetches TURN credentials from the Vercel serverless endpoint, falling back to
// FALLBACK_ICE_SERVERS on any failure so P2P features degrade gracefully instead
// of breaking. Shared by every WebRTC-based tool (Chat, QuestionBank/MusicPlayer sync).
export async function getIceServers() {
  try {
    const res = await fetch("/api/turn-credentials");
    const { iceServers, fallback } = await res.json();
    if (fallback) console.warn("TURN unavailable, using local ICE server fallback.");
    return iceServers?.length ? iceServers : FALLBACK_ICE_SERVERS;
  } catch {
    return FALLBACK_ICE_SERVERS;
  }
}

// Room directory (see api/rooms.js) — lets a host opt in to being discoverable
// without sharing a code or QR. Every call is best-effort: if the directory
// isn't configured (no Upstash env vars) these silently no-op / return empty,
// so discovery is a pure enhancement and never blocks the code/QR path.
export async function registerOpenRoom(roomId, tool) {
  try {
    await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, tool }),
    });
  } catch { /* best-effort */ }
}

export async function unregisterOpenRoom(roomId) {
  try {
    await fetch("/api/rooms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
  } catch { /* best-effort */ }
}

export async function fetchOpenRooms(tool) {
  try {
    const res = await fetch(`/api/rooms?tool=${encodeURIComponent(tool)}`);
    const { rooms, available } = await res.json();
    return available ? rooms : [];
  } catch {
    return [];
  }
}

export const generateRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ─── Generic 1:1 PeerJS room ────────────────────────────────────────────────
// Shared by any strictly-two-player P2P game (Chess online, Battleship) that
// doesn't need Poker's multi-seat host-authoritative/redacted-broadcast model
// — just one host, one guest, one DataConnection. Mirrors the shape of
// Poker/multiplayer.js's hostRoom/joinRoomAsClient, but caps the room at a
// single guest instead of exposing a seat count.
export async function hostSimpleRoom({ onJoin, onAction, onLeave, onError }) {
  const iceServers = await getIceServers();
  const peer = new Peer(generateRoomId(), { config: { iceServers } });
  let occupied = false;

  return new Promise((resolve, reject) => {
    let settled = false;
    peer.on("open", (roomId) => {
      settled = true;
      peer.on("connection", (conn) => {
        if (occupied) { conn.send({ type: "full" }); conn.close(); return; }
        occupied = true;
        conn.on("data", (msg) => {
          if (msg?.type === "hello") onJoin(conn, msg.name);
          else onAction(conn, msg);
        });
        conn.on("close", () => { occupied = false; onLeave(conn); });
        conn.on("error", () => { occupied = false; onLeave(conn); });
      });
      resolve({ peer, roomId });
    });
    peer.on("error", (e) => { if (!settled) reject(e); else onError?.(e); });
  });
}

// Joins a hostSimpleRoom by code. Resolves once the data connection is open;
// the host is echoed the caller's display name via a "hello" message.
export async function joinSimpleRoom(roomId, name, { onMessage, onClose, onError }) {
  const iceServers = await getIceServers();
  const peer = new Peer(undefined, { config: { iceServers } });

  return new Promise((resolve, reject) => {
    let settled = false;
    peer.on("open", () => {
      const conn = peer.connect(roomId, { reliable: true });
      conn.on("open", () => {
        settled = true;
        conn.send({ type: "hello", name });
        resolve({ peer, conn });
      });
      conn.on("data", onMessage);
      conn.on("close", () => onClose?.());
      conn.on("error", (e) => { if (!settled) reject(e); else onError?.(e); });
    });
    peer.on("error", (e) => { if (!settled) reject(e); });
  });
}

export function buildQrUrl(data, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
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
