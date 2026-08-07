import { useState, useRef, useCallback, useEffect } from "react";
import Peer from "peerjs";
import { getAllCategories, getAllQuestions, getAllTags, importBank } from "../db";
import { serializeBank } from "../export";
import QrScanner from "./QrScanner";

const GOOGLE_STUN = [{ urls: "stun:stun.l.google.com:19302" }];
const generateRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function getIceServers() {
  try {
    const res = await fetch("/api/turn-credentials");
    const { iceServers, fallback } = await res.json();
    if (fallback) console.warn("TURN unavailable, using Google STUN fallback.");
    return iceServers;
  } catch {
    return GOOGLE_STUN;
  }
}

function buildQrUrl(data, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

function buildSyncLink(roomId) {
  return `${window.location.origin}/toolz?tool=question_bank&sync=${roomId}`;
}

// The QR encodes a full link (so a phone's native camera app can jump
// straight into the browser) but our own scanner also accepts a bare room
// code typed or scanned from something that isn't a URL.
function extractRoomId(scanned) {
  try {
    const url = new URL(scanned);
    const fromQuery = url.searchParams.get("sync");
    if (fromQuery) return fromQuery.toUpperCase();
  } catch {
    // not a URL — fall through and treat the raw text as the room id
  }
  return scanned.trim().toUpperCase();
}

// One-way push, additive merge: the host sends its full bank as one JSON
// message over the data channel (the QR itself only ever carries a short
// room id — nowhere near enough capacity for actual question data), the
// scanning device merges it in via db.js's importBank (same path JSON
// import uses), duplicates skipped, nothing overwritten.
export default function SyncPanel({ onSynced, autoJoinRoomId }) {
  const [role, setRole] = useState(autoJoinRoomId ? "scan" : null);
  const [status, setStatus] = useState("");
  const [roomId, setRoomId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [summary, setSummary] = useState(null);
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const autoJoinedRef = useRef(false);

  useEffect(() => () => { connRef.current?.close(); peerRef.current?.destroy(); }, []);

  const startHost = async () => {
    setRole("host");
    setStatus("Starting…");
    const iceServers = await getIceServers();
    const peer = new Peer(generateRoomId(), { config: { iceServers } });
    peerRef.current = peer;
    peer.on("open", (id) => { setRoomId(id); setStatus(""); });
    peer.on("connection", (conn) => {
      connRef.current = conn;
      setStatus("Device connected — sending your question bank…");
      conn.on("open", async () => {
        const [cats, qs, tgs] = await Promise.all([getAllCategories(), getAllQuestions(), getAllTags()]);
        conn.send(serializeBank(cats, qs, tgs));
        setStatus(`Sent ${qs.length} question(s) across ${cats.length} categor${cats.length === 1 ? "y" : "ies"}. You can close this once the other device confirms.`);
      });
    });
    peer.on("error", (e) => setStatus("Error: " + e.message));
  };

  const connectToRoom = useCallback(async (targetRoomId) => {
    setConnecting(true);
    setStatus(`Connecting to ${targetRoomId}…`);
    const iceServers = await getIceServers();
    const peer = new Peer(undefined, { config: { iceServers } });
    peerRef.current = peer;
    peer.on("open", () => {
      const conn = peer.connect(targetRoomId, { reliable: true });
      connRef.current = conn;
      conn.on("open", () => setStatus("Connected — waiting for the bank…"));
      conn.on("data", async (bankData) => {
        setStatus("Merging…");
        try {
          const result = await importBank(bankData);
          setSummary(result);
          setStatus("Done.");
          onSynced();
        } catch (err) {
          setStatus("Import failed: " + err.message);
        } finally {
          conn.close();
          peer.destroy();
        }
      });
      conn.on("error", (e) => setStatus("Error: " + e.message));
    });
    peer.on("error", (e) => setStatus("Error: " + e.message));
  }, [onSynced]);

  useEffect(() => {
    if (autoJoinRoomId && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      setRole("scan");
      connectToRoom(autoJoinRoomId);
    }
  }, [autoJoinRoomId, connectToRoom]);

  const handleDecode = useCallback((scanned) => connectToRoom(extractRoomId(scanned)), [connectToRoom]);

  const reset = () => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null; peerRef.current = null;
    setRole(null); setStatus(""); setRoomId(""); setSummary(null); setManualInput(""); setConnecting(false);
  };

  if (role === null) {
    return (
      <div className="tk-qb-sync">
        <p className="tk-qb-tree-empty">
          Sync your question bank directly to another device over a peer-to-peer connection —
          nothing goes through a server except connection setup.
        </p>
        <div className="tk-qb-ocr-picker-row">
          <button className="tk-action-btn" onClick={startHost}>Show my bank as QR</button>
          <button className="tk-action-btn" onClick={() => setRole("scan")}>Scan a bank</button>
        </div>
      </div>
    );
  }

  if (role === "host") {
    return (
      <div className="tk-qb-sync">
        {roomId ? (
          <>
            <div className="tk-qb-qr-wrap">
              <img src={buildQrUrl(buildSyncLink(roomId))} alt="Scan to receive this question bank" width={200} height={200} />
            </div>
            <p className="tk-qb-review-reason">Room code: {roomId}</p>
          </>
        ) : (
          <p className="tk-qb-tree-empty">Starting…</p>
        )}
        {status && <p className="tk-qb-review-reason">{status}</p>}
        <button className="tk-action-btn" onClick={reset}>Done</button>
      </div>
    );
  }

  return (
    <div className="tk-qb-sync">
      {!connecting && !summary && <QrScanner onDecode={handleDecode} onCancel={reset} />}
      {status && <p className="tk-qb-review-reason">{status}</p>}
      {summary && (
        <p className="tk-qb-review-reason">
          Added {summary.addedQuestions} question(s), skipped {summary.skippedQuestions} duplicate(s),
          {" "}{summary.addedCategories} new categor{summary.addedCategories === 1 ? "y" : "ies"},
          {" "}{summary.addedTags} new tag(s).
        </p>
      )}
      {!connecting && !summary && (
        <div className="tk-qb-ocr-picker-row">
          <input
            className="tk-input-field"
            placeholder="Or type the room code…"
            value={manualInput}
            onChange={e => setManualInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && manualInput.trim() && connectToRoom(manualInput.trim())}
          />
          <button className="tk-action-btn" onClick={() => manualInput.trim() && connectToRoom(manualInput.trim())}>Connect</button>
        </div>
      )}
      <button className="tk-action-btn" onClick={reset}>{summary ? "Done" : "Cancel"}</button>
    </div>
  );
}
