import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import Peer from "peerjs";
import {
  FaPhone, FaPhoneSlash, FaVideo, FaVideoSlash,
  FaMicrophone, FaMicrophoneSlash, FaDesktop,
} from "react-icons/fa";
import { getIceServers, generateRoomId, buildQrUrl, registerOpenRoom, unregisterOpenRoom, fetchOpenRooms } from "./tk-shared.jsx";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const CHUNK_SIZE = 16 * 1024;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildObjectUrl(msg) {
  return URL.createObjectURL(new Blob([msg.data], { type: msg.mime }));
}

function concatArrayBuffers(buffers) {
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
async function sendFileChunked(conn, file, id, onProgress) {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  conn.send({ type: "file-start", id, name: file.name, mime: file.type, size: file.size, totalChunks });
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const buf = await file.slice(start, start + CHUNK_SIZE).arrayBuffer();
    conn.send({ type: "file-chunk", id, index: i, data: buf });
    onProgress((i + 1) / totalChunks);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ label, color, textColor = "#fff" }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 600, color: textColor, flexShrink: 0,
    }}>{label}</div>
  );
}

function ProgressBar({ progress, isMe, label }) {
  return (
    <div style={{ marginTop: 6, minWidth: 120 }}>
      <div style={{ height: 4, borderRadius: 2, background: isMe ? "rgba(0,0,0,0.2)" : "var(--tk-border-bright)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.round(progress * 100)}%`,
          background: "var(--tk-accent)", transition: "width 0.15s ease",
        }} />
      </div>
      <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8 }}>{label}… {Math.round(progress * 100)}%</div>
    </div>
  );
}

function FilePreview({ msg, isMe }) {
  const urlRef = useRef(null);
  const isReceiving = msg.data == null;
  const inProgress = msg.progress !== undefined && msg.progress < 1;
  if (!isReceiving && !urlRef.current) urlRef.current = buildObjectUrl(msg);
  const url = urlRef.current;

  if (isReceiving) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>📎</span>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{msg.name}</div>
        </div>
        <ProgressBar progress={msg.progress ?? 0} isMe={isMe} label="Receiving" />
      </div>
    );
  }

  if (msg.mime?.startsWith("image/")) return (
    <div>
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={msg.name}
          style={{ maxWidth: 200, maxHeight: 160, borderRadius: 8, display: "block", cursor: "pointer" }} />
      </a>
      {inProgress && <ProgressBar progress={msg.progress} isMe={isMe} label="Sending" />}
    </div>
  );

  if (msg.mime?.startsWith("audio/")) return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: isMe ? "var(--tk-bg)" : "var(--tk-text-dim)" }}>{msg.name}</p>
      <audio controls src={url} style={{ maxWidth: 220 }} />
      {inProgress && <ProgressBar progress={msg.progress} isMe={isMe} label="Sending" />}
    </div>
  );

  return (
    <div>
      <a href={url} download={msg.name} style={{
        display: "flex", alignItems: "center", gap: 8,
        color: isMe ? "var(--tk-bg)" : "var(--tk-text)", textDecoration: "none",
      }}>
        <span style={{ fontSize: 20 }}>📎</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{msg.name}</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>{formatBytes(msg.size)} · tap to download</div>
        </div>
      </a>
      {inProgress && <ProgressBar progress={msg.progress} isMe={isMe} label="Sending" />}
    </div>
  );
}

const ChatBubble = memo(function ChatBubble({ msg, showAvatar }) {
  const isMe = msg.from === "me";
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 2,
      flexDirection: isMe ? "row-reverse" : "row",
    }}>
      {showAvatar
        ? <Avatar label={isMe ? "Me" : "P2"} color={isMe ? "var(--tk-accent)" : "var(--tk-info)"} textColor={isMe ? "var(--tk-bg)" : "#fff"} />
        : <div style={{ width: 28 }} />}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 2, alignItems: isMe ? "flex-end" : "flex-start" }}>
        <div style={{
          padding: msg.type === "file" ? "10px 12px" : "9px 13px",
          borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isMe ? "var(--tk-accent)" : "var(--tk-surface2)",
          color: isMe ? "var(--tk-bg)" : "var(--tk-text)",
          fontSize: 14, lineHeight: 1.55, wordBreak: "break-word",
          whiteSpace: msg.type === "text" ? "pre-wrap" : "normal",
        }}>
          {msg.type === "text" ? msg.text : <FilePreview msg={msg} isMe={isMe} />}
        </div>
        <span style={{ fontSize: 11, color: "var(--tk-text-dim)", paddingInline: 4 }}>
          {formatTime(msg.ts)}
          {isMe && (
            <span style={{ marginLeft: 4, color: msg.delivered ? "var(--tk-accent)" : "var(--tk-text-dim)" }}>
              {msg.delivered ? "✓✓" : "✓"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

const DateDivider = memo(function DateDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px" }}>
      <div style={{ flex: 1, height: "0.5px", background: "var(--tk-border)" }} />
      <span style={{ fontSize: 11, color: "var(--tk-text-dim)", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: "0.5px", background: "var(--tk-border)" }} />
    </div>
  );
});

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 4 }}>
      <Avatar label="P2" color="var(--tk-info)" />
      <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "var(--tk-surface2)", display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "var(--tk-text-dim)",
            animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text, label = "Copy ID" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  return <button onClick={copy} style={s.btnOutline}>{copied ? "✓ Copied" : label}</button>;
}

function buildShareLink(roomId) {
  return `${window.location.origin}/toolz?tool=chat&room=${roomId}`;
}

function FileStagePreview({ file, onCancel, onConfirm }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const isImage = file.type.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div style={s.stagePreview}>
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={file.name} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: 22, flexShrink: 0 }}>📎</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
        <div style={{ fontSize: 11, color: "var(--tk-text-dim)" }}>{formatBytes(file.size)}</div>
      </div>
      <button style={s.iconBtn} title="Cancel" onClick={onCancel}>✕</button>
      <button style={s.btnPrimary} onClick={onConfirm}>Send</button>
    </div>
  );
}

// Owns all composing state (text, staged file, typing timer) in isolation from the
// message list — so keystrokes only re-render this small component, not the whole
// (potentially long) chat history above it.
function MessageComposer({ onSendText, onSendFile, onTyping }) {
  const [msgInput, setMsgInput] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError] = useState("");

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const myTypingRef = useRef(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [msgInput]);

  const handleInputChange = (e) => {
    setMsgInput(e.target.value);
    if (!myTypingRef.current) { myTypingRef.current = true; onTyping(true); }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => { myTypingRef.current = false; onTyping(false); }, 1500);
  };

  const handleSend = () => {
    const text = msgInput.trim();
    if (!text) return;
    clearTimeout(typingTimerRef.current);
    myTypingRef.current = false;
    onTyping(false);
    onSendText(text);
    setMsgInput("");
  };

  const handleFileSelected = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`Max file size is ${formatBytes(MAX_FILE_SIZE)}.`);
      return;
    }
    setFileError("");
    setPendingFile(file);
  };

  const confirmSendFile = () => {
    if (!pendingFile) return;
    onSendFile(pendingFile);
    setPendingFile(null);
  };

  return (
    <div>
      {fileError && (
        <div style={{ padding: "6px 16px", background: "rgba(255, 51, 102, 0.12)", fontSize: 12, color: "var(--tk-accent2)" }}>
          {fileError}
        </div>
      )}
      {pendingFile && (
        <FileStagePreview file={pendingFile} onCancel={() => setPendingFile(null)} onConfirm={confirmSendFile} />
      )}
      <div style={s.inputBar}>
        <input ref={fileInputRef} type="file" style={{ display: "none" }}
          onChange={e => { if (e.target.files[0]) handleFileSelected(e.target.files[0]); e.target.value = ""; }} />
        <button style={s.iconBtn} title="Send file" onClick={() => fileInputRef.current.click()}>📎</button>
        <textarea
          ref={textareaRef}
          rows={1}
          style={s.textarea}
          placeholder="Message…"
          value={msgInput}
          onChange={handleInputChange}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button style={s.btnPrimary} onClick={handleSend} disabled={!msgInput.trim()}>Send</button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function P2PChat() {
  const [view, setView] = useState("home");
  const [joinInput, setJoinInput] = useState("");
  const [myId, setMyId] = useState("");
  const [messages, setMessages] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [discoverable, setDiscoverable] = useState(false);
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // ─── Calling (audio/video/screen-share) ──────────────────────────────────
  const [callState, setCallState] = useState("idle"); // idle | outgoing | incoming | active
  const [callType, setCallType] = useState("audio");  // audio | video
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const messagesEndRef = useRef(null);
  const incomingTransfersRef = useRef(new Map());
  const roomHeartbeatRef = useRef(null);

  const callRef = useRef(null);           // active PeerJS MediaConnection
  const incomingCallRef = useRef(null);   // MediaConnection awaiting accept/decline
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);        // local camera preview
  const localScreenVideoRef = useRef(null);  // local outgoing-screen preview
  const remoteVideoRef = useRef(null);       // remote camera (or the lone <audio> for voice calls)
  const remoteScreenVideoRef = useRef(null); // remote peer's shared screen, if any
  const screenShareRef = useRef(null);       // { screenStream, screenTrack, sender } while sharing
  // A call's first "stream" event is always the camera/mic; PeerJS fires one
  // "stream" event per remote MediaStream, so a second one occurring later in
  // the same call can only be a screen share added via addTrack afterwards —
  // no need to correlate stream ids across the data channel to tell them apart.
  const primaryStreamReceivedRef = useRef(false);

  // Manual only — no polling interval, so sitting idle on the home screen
  // doesn't keep hammering the directory endpoint.
  const refreshOpenRooms = useCallback(async () => {
    setRoomsLoading(true);
    const rooms = await fetchOpenRooms("chat");
    setOpenRooms(rooms);
    setRoomsLoading(false);
  }, []);

  // One-time load when the home screen first shows, so the list isn't empty
  // before the user has a reason to hit refresh.
  useEffect(() => {
    if (view === "home") refreshOpenRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // ─── Calling ──────────────────────────────────────────────────────────────
  // Layers a PeerJS MediaConnection on top of the existing DataConnection's
  // Peer instance/ICE config — no extra signaling needed. The callee always
  // sees an incoming-call prompt first; `call.answer()` only ever runs after
  // they explicitly accept.
  const endCall = useCallback(() => {
    callRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenShareRef.current?.screenTrack.stop();
    callRef.current = null;
    incomingCallRef.current = null;
    localStreamRef.current = null;
    screenShareRef.current = null;
    primaryStreamReceivedRef.current = false;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteScreenVideoRef.current) remoteScreenVideoRef.current.srcObject = null;
    setCallState("idle");
    setIsMuted(false); setIsCameraOff(false); setIsScreenSharing(false); setIsRemoteScreenSharing(false);
  }, []);

  // Runs after the call panel's DOM actually mounts/changes — assigns the
  // local preview from the ref (not state) since getUserMedia is fetched
  // imperatively in startCall/acceptCall, not stored as render state.
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
  }, [callState, callType]);

  const wireCall = useCallback((call) => {
    callRef.current = call;
    primaryStreamReceivedRef.current = false;
    call.on("stream", (remoteStream) => {
      if (!primaryStreamReceivedRef.current) {
        primaryStreamReceivedRef.current = true;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        setCallState("active");
      } else if (remoteScreenVideoRef.current) {
        remoteScreenVideoRef.current.srcObject = remoteStream;
      }
    });
    call.on("close", endCall);
    call.on("error", endCall);
  }, [endCall]);

  // Local <video>/<audio> preview is wired via the effect below rather than
  // right here — at this exact line the call panel (which the preview
  // element lives in) hasn't necessarily mounted yet, so the ref can still
  // be null the instant the stream arrives.
  const startCall = async (video) => {
    if (!connRef.current?.open || callState !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      setCallType(video ? "video" : "audio");
      setCallState("outgoing");
      wireCall(peerRef.current.call(connRef.current.peer, stream, { metadata: { video } }));
    } catch (e) {
      setStatusMsg("Could not access camera/microphone: " + e.message);
    }
  };

  const acceptCall = async () => {
    const call = incomingCallRef.current;
    if (!call) return;
    try {
      const video = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      setCallState("outgoing"); // "connecting" in spirit — mounts the call panel before the remote stream can arrive
      call.answer(stream);
      wireCall(call);
    } catch (e) {
      setStatusMsg("Could not access camera/microphone: " + e.message);
      call.close();
      incomingCallRef.current = null;
      setCallState("idle");
    }
  };

  const declineCall = () => {
    incomingCallRef.current?.close();
    incomingCallRef.current = null;
    setCallState("idle");
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCameraOff(!track.enabled);
  };

  // Adds the screen as a *second* outgoing video track (RTCPeerConnection.
  // addTrack) rather than replacing the camera track — so both keep flowing
  // at once. Adding a track fires the underlying peerConnection's
  // negotiationneeded event, which PeerJS's MediaConnection already listens
  // for and renegotiates automatically, same as setting up the call itself.
  // Scoped to video calls only: an audio-only call has no camera sender
  // already established for this to layer alongside.
  const startScreenShare = async () => {
    if (!callRef.current || callType !== "video" || isScreenSharing) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = callRef.current.peerConnection?.addTrack(screenTrack, screenStream);
      screenShareRef.current = { screenStream, screenTrack, sender };
      screenTrack.onended = () => stopScreenShare(); // user hit the browser's built-in "Stop sharing"
      if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = screenStream;
      connRef.current?.send({ type: "call-meta", sharingScreen: true });
      setIsScreenSharing(true);
    } catch (e) {
      setStatusMsg("Could not start screen share: " + e.message);
    }
  };

  const stopScreenShare = () => {
    const shared = screenShareRef.current;
    if (!shared) return;
    if (shared.sender) callRef.current?.peerConnection?.removeTrack(shared.sender);
    shared.screenTrack.stop();
    screenShareRef.current = null;
    if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = null;
    connRef.current?.send({ type: "call-meta", sharingScreen: false });
    setIsScreenSharing(false);
  };

  const setupConn = useCallback((conn, asHost) => {
    conn.on("open", () => { if (!asHost) setView("chat"); setStatusMsg(""); });

    conn.on("data", (data) => {
      if (data.type === "typing") { setPeerTyping(data.value); return; }

      if (data.type === "call-meta") {
        setIsRemoteScreenSharing(!!data.sharingScreen);
        if (!data.sharingScreen && remoteScreenVideoRef.current) remoteScreenVideoRef.current.srcObject = null;
        return;
      }

      if (data.type === "delivered") {
        setMessages(prev => prev.map(m => m.id === data.id ? { ...m, delivered: true } : m));
        return;
      }

      if (data.type === "file-start") {
        incomingTransfersRef.current.set(data.id, { chunks: new Array(data.totalChunks), received: 0, totalChunks: data.totalChunks });
        setMessages(prev => [...prev, {
          id: data.id, type: "file", from: "them", ts: new Date(),
          name: data.name, mime: data.mime, size: data.size, data: null, progress: 0,
        }]);
        return;
      }

      if (data.type === "file-chunk") {
        const transfer = incomingTransfersRef.current.get(data.id);
        if (!transfer) return;
        transfer.chunks[data.index] = data.data;
        transfer.received += 1;
        const progress = transfer.received / transfer.totalChunks;

        if (transfer.received === transfer.totalChunks) {
          incomingTransfersRef.current.delete(data.id);
          const fullBuffer = concatArrayBuffers(transfer.chunks);
          setMessages(prev => prev.map(m => m.id === data.id ? { ...m, data: fullBuffer, progress: undefined } : m));
          conn.send({ type: "delivered", id: data.id });
        } else {
          setMessages(prev => prev.map(m => m.id === data.id ? { ...m, progress } : m));
        }
        return;
      }

      const msgId = data.id || Date.now();
      setMessages(prev => [...prev, { ...data, from: "them", ts: new Date(), id: msgId }]);
      conn.send({ type: "delivered", id: msgId });
    });

    conn.on("close", () => { endCall(); setStatusMsg("Connection closed."); setView("home"); setMessages([]); });
    conn.on("error", (e) => setStatusMsg("Error: " + e.message));
  }, [endCall]);

  // Stops announcing this room in the open-room directory — called once a peer
  // connects (it's no longer "open") or the host leaves before anyone joins.
  const stopRoomHeartbeat = useCallback((roomId) => {
    if (roomHeartbeatRef.current) { clearInterval(roomHeartbeatRef.current); roomHeartbeatRef.current = null; }
    if (roomId) unregisterOpenRoom(roomId);
  }, []);

  const createRoom = async () => {
    const wantsDiscoverable = discoverable;
    const iceServers = await getIceServers();
    const peer = new Peer(generateRoomId(), { config: { iceServers } });
    peerRef.current = peer;
    peer.on("open", (id) => {
      setMyId(id);
      setView("waiting");
      if (wantsDiscoverable) {
        registerOpenRoom(id, "chat");
        roomHeartbeatRef.current = setInterval(() => registerOpenRoom(id, "chat"), 20000);
      }
    });
    peer.on("connection", (conn) => {
      stopRoomHeartbeat(peerRef.current?.id);
      connRef.current = conn; setupConn(conn, true); setView("chat");
    });
    peer.on("call", (call) => {
      incomingCallRef.current = call;
      setCallType(call.metadata?.video ? "video" : "audio");
      setCallState("incoming");
    });
    peer.on("error", (e) => setStatusMsg("Error: " + e.message));
  };

  const joinRoom = async (roomIdOverride) => {
    const roomId = (roomIdOverride ?? joinInput).trim().toUpperCase();
    if (!roomId) return;
    const iceServers = await getIceServers();
    const peer = new Peer(undefined, { config: { iceServers } });
    peerRef.current = peer;
    peer.on("open", () => {
      setStatusMsg("Connecting…");
      const conn = peer.connect(roomId, { reliable: true });
      connRef.current = conn;
      setupConn(conn, false);
    });
    peer.on("call", (call) => {
      incomingCallRef.current = call;
      setCallType(call.metadata?.video ? "video" : "audio");
      setCallState("incoming");
    });
    peer.on("error", (e) => setStatusMsg("Error: " + e.message));
  };

  // Auto-join when opened via a shared link (?tool=chat&room=XXXXXX) — the
  // whole point is that the recipient shouldn't have to type anything.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) {
      setShowJoin(true);
      setJoinInput(room.toUpperCase());
      joinRoom(room);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendTypingSignal = useCallback((value) => {
    connRef.current?.open && connRef.current.send({ type: "typing", value });
  }, []);

  const sendText = useCallback((text) => {
    if (!connRef.current?.open) return;
    const id = Date.now();
    connRef.current.send({ type: "text", text, id });
    setMessages(prev => [...prev, { type: "text", text, id, from: "me", ts: new Date(), delivered: false }]);
  }, []);

  const sendFile = useCallback(async (file) => {
    if (!connRef.current?.open) return;
    const id = Date.now();
    // The sender already has the full file locally, so its own bubble can preview
    // it immediately — only the progress bar reflects the actual transfer to the peer.
    setMessages(prev => [...prev, {
      id, type: "file", from: "me", ts: new Date(),
      name: file.name, mime: file.type, size: file.size, data: file, progress: 0, delivered: false,
    }]);
    await sendFileChunked(connRef.current, file, id, (progress) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, progress } : m));
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, progress: undefined } : m));
  }, []);

  const disconnect = () => {
    endCall(); // never leave a hot mic/camera running behind a closed chat
    stopRoomHeartbeat(peerRef.current?.id);
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null; peerRef.current = null;
    incomingTransfersRef.current.clear();
    setView("home"); setMessages([]); setJoinInput("");
    setShowJoin(false); setStatusMsg(""); setPeerTyping(false);
  };

  // Safety net for a closed tab / unmount while a discoverable room is still
  // waiting — the directory entry also expires on its own via TTL either way.
  useEffect(() => () => stopRoomHeartbeat(peerRef.current?.id), [stopRoomHeartbeat]);

  const grouped = useMemo(() => messages.map((msg, i) => ({
    ...msg,
    showAvatar: i === 0 || messages[i - 1].from !== msg.from,
    showDate: i === 0 || new Date(msg.ts).toDateString() !== new Date(messages[i - 1].ts).toDateString(),
  })), [messages]);

  // ─── Views ────────────────────────────────────────────────────────────────

  if (view === "home") return (
    <div style={s.page} className="p2pchat-root">
      <style>{globalStyles}</style>
      <div style={s.card}>
        <h2 style={s.title}>P2P Chat</h2>
        <p style={{ ...s.muted, margin: "0 0 20px" }}>Direct, encrypted, no account needed.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button style={s.btnPrimary} onClick={createRoom}>+ Create room</button>
          <button style={s.btnOutline} onClick={() => setShowJoin(v => !v)}>Join room</button>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--tk-text-dim)", marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={discoverable} onChange={e => setDiscoverable(e.target.checked)} />
          List my next room below so others can join without a code
        </label>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={s.muted}>Open rooms — tap to join instantly:</p>
            <button style={{ ...s.iconBtn, fontSize: 13 }} onClick={refreshOpenRooms} disabled={roomsLoading} title="Refresh list">
              {roomsLoading ? "…" : "⟳"}
            </button>
          </div>
          {openRooms.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {openRooms.map(r => (
                <button key={r.roomId} style={{ ...s.btnOutline, textAlign: "left" }} onClick={() => joinRoom(r.roomId)}>
                  {r.roomId} <span style={{ opacity: 0.6, fontSize: 11 }}>· waiting</span>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ ...s.muted, fontSize: 12 }}>{roomsLoading ? "Checking…" : "None right now."}</p>
          )}
        </div>

        {showJoin && (
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder="Room ID (e.g. AB12CD)"
              value={joinInput} onChange={e => setJoinInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinRoom()} autoFocus />
            <button style={s.btnPrimary} onClick={() => joinRoom()}>Connect</button>
          </div>
        )}

        {statusMsg && <p style={{ ...s.muted, margin: "10px 0 0", color: "var(--tk-accent2)" }}>{statusMsg}</p>}

        <div style={{ marginTop: 20, padding: "12px 14px", background: "var(--tk-surface2)", borderRadius: 10, border: "0.5px solid var(--tk-border)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--tk-text-dim)", lineHeight: 1.6 }}>
            🔒 Messages travel directly between browsers via WebRTC.<br />
            Nothing is stored. Closing the tab ends the session.
          </p>
        </div>
      </div>
    </div>
  );

  if (view === "waiting") {
    const shareLink = buildShareLink(myId);
    return (
      <div style={s.page} className="p2pchat-root">
        <style>{globalStyles}</style>
        <div style={s.card}>
          <h2 style={s.title}>Room ready</h2>
          <p style={s.muted}>Share the link or QR code below — whoever opens it connects instantly, no typing needed.</p>
          {discoverable && (
            <p style={{ ...s.muted, margin: "6px 0 0", color: "var(--tk-info)" }}>
              📡 Also listed publicly — anyone on the home screen can join without the code.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--tk-surface2)", border: "0.5px solid var(--tk-border-bright)", borderRadius: 10, padding: "12px 16px", margin: "16px 0 10px" }}>
            <code style={{ flex: 1, fontSize: 22, fontFamily: "monospace", letterSpacing: "0.15em", color: "var(--tk-info)" }}>{myId}</code>
            <CopyButton text={myId} label="Copy ID" />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
            <code style={{ flex: 1, fontSize: 12, color: "var(--tk-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareLink}</code>
            <CopyButton text={shareLink} label="Copy Link" />
          </div>

          <div style={{ textAlign: "center", padding: 16, background: "#fff", border: "0.5px solid var(--tk-border-bright)", borderRadius: 10, marginBottom: 20 }}>
            <img src={buildQrUrl(shareLink)} alt="Scan to join this room" width={180} height={180} style={{ display: "block", margin: "0 auto" }} />
            <p style={{ fontSize: 12, color: "#374151", marginTop: 10 }}>📷 Scan with a phone camera to join</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--tk-text-dim)", fontSize: 13 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--tk-accent3)", animation: "bounce 1.2s ease-in-out infinite" }} />
            Waiting for someone to join…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.chatContainer} className="p2pchat-root">
      <style>{globalStyles}</style>

      <div style={s.chatHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--tk-accent)", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>Room · {myId}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--tk-text-dim)" }}>End-to-end encrypted · files up to 20 MB</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {callState === "idle" && (
            <>
              <button style={s.iconBtn} title="Voice call" onClick={() => startCall(false)}><FaPhone size={14} /></button>
              <button style={s.iconBtn} title="Video call" onClick={() => startCall(true)}><FaVideo size={14} /></button>
            </>
          )}
          <button style={s.btnDanger} onClick={disconnect}>Leave</button>
        </div>
      </div>

      {callState === "incoming" && (
        <div style={s.callBanner}>
          <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            {callType === "video" ? <FaVideo /> : <FaPhone />} Incoming {callType} call…
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.btnPrimary} onClick={acceptCall}><FaPhone size={13} /> Accept</button>
            <button style={s.btnDanger} onClick={declineCall}><FaPhoneSlash size={13} /> Decline</button>
          </div>
        </div>
      )}

      {(callState === "outgoing" || callState === "active") && (
        <div style={s.callPanel}>
          {callState === "outgoing" && <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--tk-text-dim)" }}>Connecting…</p>}
          {callType === "video" && (
            <div style={s.videoStage}>
              {/* Both remote elements stay mounted for the whole call so their refs
                  exist the instant a "stream" event fires — only their visibility
                  toggles with whether the peer is currently sharing their screen. */}
              <video ref={remoteScreenVideoRef} autoPlay playsInline style={{ ...s.remoteVideo, display: isRemoteScreenSharing ? "block" : "none" }} />
              <video ref={remoteVideoRef} autoPlay playsInline style={{ ...s.remoteVideo, display: isRemoteScreenSharing ? "none" : "block" }} />
              <video ref={localVideoRef} autoPlay playsInline muted style={s.localVideo} />
              <video ref={localScreenVideoRef} autoPlay playsInline muted style={{ ...s.localVideo, ...s.localScreenThumb, display: isScreenSharing ? "block" : "none" }} />
            </div>
          )}
          {callType === "audio" && (
            <>
              {/* Not rendered visually — carries the remote audio track. Mounted for
                  the whole outgoing→active lifecycle so the ref exists the moment
                  the "stream" event actually arrives. */}
              <audio ref={remoteVideoRef} autoPlay style={{ display: "none" }} />
              {callState === "active" && <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--tk-text)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FaPhone size={12} /> Voice call connected</p>}
            </>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
            <button style={s.iconBtn} title={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
              {isMuted ? <FaMicrophoneSlash size={14} /> : <FaMicrophone size={14} />}
            </button>
            {callType === "video" && (
              <button style={s.iconBtn} title={isCameraOff ? "Turn camera on" : "Turn camera off"} onClick={toggleCamera}>
                {isCameraOff ? <FaVideoSlash size={14} /> : <FaVideo size={14} />}
              </button>
            )}
            {callType === "video" && canScreenShare && (
              <button
                style={{ ...s.iconBtn, ...(isScreenSharing ? s.iconBtnActive : null) }}
                title={isScreenSharing ? "Stop sharing your screen" : "Share your screen"}
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              >
                <FaDesktop size={14} />
              </button>
            )}
            <button style={s.btnDanger} onClick={endCall}><FaPhoneSlash size={13} /> Hang up</button>
          </div>
        </div>
      )}

      <div style={s.messageArea}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--tk-text-dim)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
            <p style={{ fontSize: 13 }}>Connected! Say hello.</p>
          </div>
        )}
        {grouped.map(msg => (
          <div key={msg.id}>
            {msg.showDate && <DateDivider label={msg.ts.toDateString()} />}
            <ChatBubble msg={msg} showAvatar={msg.showAvatar} />
          </div>
        ))}
        {peerTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer onSendText={sendText} onSendFile={sendFile} onTyping={sendTypingSignal} />
    </div>
  );
}

const globalStyles = `
@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
.p2pchat-root input::placeholder,
.p2pchat-root textarea::placeholder { color: var(--tk-text-dim); opacity: 1; }
`;

const s = {
  page: { maxWidth: 480, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui,sans-serif", color: "var(--tk-text)" },
  card: { background: "var(--tk-surface)", border: "0.5px solid var(--tk-border)", borderRadius: 14, padding: "1.75rem" },
  chatContainer: {
    maxWidth: 480, margin: "1rem auto", fontFamily: "system-ui,sans-serif", color: "var(--tk-text)",
    background: "var(--tk-surface)", border: "0.5px solid var(--tk-border)", borderRadius: 14,
    display: "flex", flexDirection: "column", overflow: "hidden",
    // This tool renders inside the site's own sticky header + topbar + footer, not
    // as a standalone page — clamp() leaves room for that surrounding chrome (~260px)
    // instead of claiming a near-full extra viewport on top of it.
    height: "clamp(420px, calc(100vh - 260px), 720px)",
  },
  chatHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px", borderBottom: "0.5px solid var(--tk-border)",
  },
  messageArea: { flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column" },
  callBanner: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
    padding: "10px 16px", background: "var(--tk-surface2)", borderBottom: "0.5px solid var(--tk-border)",
  },
  callPanel: {
    padding: "12px 16px", borderBottom: "0.5px solid var(--tk-border)",
    background: "var(--tk-surface2)", textAlign: "center",
  },
  videoStage: {
    position: "relative", width: "100%", maxWidth: 380, aspectRatio: "4/3", margin: "0 auto",
    background: "#000", borderRadius: 10, overflow: "hidden",
  },
  remoteVideo: { width: "100%", height: "100%", objectFit: "cover" },
  localVideo: {
    position: "absolute", bottom: 8, right: 8, width: "28%", aspectRatio: "4/3",
    objectFit: "cover", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.6)",
  },
  // Second local PiP (own outgoing screen share) — opposite corner from the
  // camera preview so both can show at once.
  localScreenThumb: { bottom: "auto", right: "auto", top: 8, left: 8, border: "1.5px solid rgba(110,231,183,0.85)" },
  inputBar: { display: "flex", gap: 8, alignItems: "flex-end", padding: "10px 12px", borderTop: "0.5px solid var(--tk-border)" },
  stagePreview: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
    borderTop: "0.5px solid var(--tk-border)", background: "var(--tk-surface2)",
  },
  title: { margin: "0 0 4px", fontSize: 20, fontWeight: 600, color: "var(--tk-text)" },
  muted: { margin: 0, fontSize: 13, color: "var(--tk-text-dim)", lineHeight: 1.5 },
  input: { padding: "9px 13px", borderRadius: 9, border: "0.5px solid var(--tk-border-bright)", fontSize: 14, outline: "none", background: "var(--tk-surface2)", color: "var(--tk-text)" },
  textarea: {
    flex: 1, padding: "9px 13px", borderRadius: 9, border: "0.5px solid var(--tk-border-bright)",
    fontSize: 14, outline: "none", background: "var(--tk-surface2)", color: "var(--tk-text)",
    fontFamily: "inherit", resize: "none", maxHeight: 120, lineHeight: 1.4,
  },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: "var(--tk-accent)", color: "var(--tk-bg)", fontSize: 14, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  btnOutline: { padding: "9px 18px", borderRadius: 9, border: "0.5px solid var(--tk-border-bright)", background: "transparent", color: "var(--tk-text)", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  btnDanger: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--tk-accent2)", background: "transparent", color: "var(--tk-accent2)", fontSize: 13, cursor: "pointer" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "6px 10px", borderRadius: 8, border: "0.5px solid var(--tk-border-bright)", background: "var(--tk-surface2)", color: "var(--tk-text)", fontSize: 16, cursor: "pointer", lineHeight: 1 },
  iconBtnActive: { background: "var(--tk-accent)", color: "var(--tk-bg)", borderColor: "var(--tk-accent)" },
};
