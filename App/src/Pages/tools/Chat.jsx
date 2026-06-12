import { useState, useEffect, useRef, useCallback } from "react";
import Peer from "peerjs";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const generateId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Serialise file → chunks of ArrayBuffer for PeerJS DataChannel
async function fileToChunks(file) {
  const buffer = await file.arrayBuffer();
  return {
    type: "file",
    name: file.name,
    mime: file.type,
    size: file.size,
    data: buffer,
  };
}

function buildObjectUrl(msg) {
  const blob = new Blob([msg.data], { type: msg.mime });
  return URL.createObjectURL(blob);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Avatar({ label, color }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: color, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 11, fontWeight: 600,
      color: "#fff", flexShrink: 0,
    }}>{label}</div>
  );
}

function FilePreview({ msg, isMe }) {
  const isImage = msg.mime?.startsWith("image/");
  const isAudio = msg.mime?.startsWith("audio/");
  const urlRef = useRef(null);

  if (!urlRef.current) urlRef.current = buildObjectUrl(msg);
  const url = urlRef.current;

  if (isImage) return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={msg.name}
        style={{ maxWidth: 200, maxHeight: 160, borderRadius: 8, display: "block", cursor: "pointer" }} />
    </a>
  );

  if (isAudio) return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: isMe ? "#93c5fd" : "#6b7280" }}>{msg.name}</p>
      <audio controls src={url} style={{ maxWidth: 220 }} />
    </div>
  );

  return (
    <a href={url} download={msg.name} style={{
      display: "flex", alignItems: "center", gap: 8,
      color: isMe ? "#bfdbfe" : "#374151", textDecoration: "none",
    }}>
      <span style={{ fontSize: 20 }}>📎</span>
      <span>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{msg.name}</div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>{formatBytes(msg.size)} · tap to download</div>
      </span>
    </a>
  );
}

function ChatBubble({ msg, showAvatar }) {
  const isMe = msg.from === "me";

  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "flex-end",
      flexDirection: isMe ? "row-reverse" : "row",
      marginBottom: 2,
    }}>
      {showAvatar
        ? <Avatar label={isMe ? "Me" : "P2"} color={isMe ? "#2563eb" : "#7c3aed"} />
        : <div style={{ width: 28 }} />}

      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 2, alignItems: isMe ? "flex-end" : "flex-start" }}>
        <div style={{
          padding: msg.type === "file" ? "10px 12px" : "9px 13px",
          borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isMe ? "#2563eb" : "#f3f4f6",
          color: isMe ? "#fff" : "#111827",
          fontSize: 14, lineHeight: 1.55, wordBreak: "break-word",
        }}>
          {msg.type === "text" && msg.text}
          {msg.type === "file" && <FilePreview msg={msg} isMe={isMe} />}
        </div>
        <span style={{ fontSize: 11, color: "#9ca3af", paddingInline: 4 }}>
          {formatTime(msg.ts)}
          {isMe && <span style={{ marginLeft: 4, color: msg.delivered ? "#22c55e" : "#d1d5db" }}>
            {msg.delivered ? "✓✓" : "✓"}
          </span>}
        </span>
      </div>
    </div>
  );
}

function DateDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px" }}>
      <div style={{ flex: 1, height: "0.5px", background: "#e5e7eb" }} />
      <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: "0.5px", background: "#e5e7eb" }} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 4 }}>
      <Avatar label="P2" color="#7c3aed" />
      <div style={{
        padding: "10px 14px", borderRadius: "16px 16px 16px 4px",
        background: "#f3f4f6", display: "flex", gap: 4, alignItems: "center",
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "#9ca3af",
            animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} style={s.btnOutline}>
      {copied ? "✓ Copied" : "Copy ID"}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function P2PChat() {
  const [view, setView] = useState("home");
  const [joinInput, setJoinInput] = useState("");
  const [myId, setMyId] = useState("");
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [fileError, setFileError] = useState("");

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const myTypingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // ── Typing signals ────────────────────────────────────────────
  const sendTypingSignal = (isTyping) => {
    if (connRef.current?.open) {
      connRef.current.send({ type: "typing", value: isTyping });
    }
  };

  const handleInputChange = (e) => {
    setMsgInput(e.target.value);
    if (!myTypingRef.current) {
      myTypingRef.current = true;
      sendTypingSignal(true);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      myTypingRef.current = false;
      sendTypingSignal(false);
    }, 1500);
  };

  // ── Connection setup ──────────────────────────────────────────
  const setupConn = useCallback((conn, asHost) => {
    conn.on("open", () => {
      if (!asHost) setView("chat");
      setStatusMsg("");
    });

    conn.on("data", (data) => {
      if (data.type === "typing") {
        setPeerTyping(data.value);
        return;
      }
      if (data.type === "delivered") {
        setMessages(prev => prev.map(m => m.id === data.id ? { ...m, delivered: true } : m));
        return;
      }
      const msgId = data.id || Date.now();
      setMessages(prev => [...prev, { ...data, from: "them", ts: new Date(), id: msgId }]);
      // Acknowledge receipt
      conn.send({ type: "delivered", id: msgId });
    });

    conn.on("close", () => {
      setStatusMsg("Connection closed.");
      setView("home");
      setMessages([]);
    });

    conn.on("error", (e) => setStatusMsg("Error: " + e.message));
  }, []);

  const createRoom = () => {
    const id = generateId();
    const peer = new Peer(id);
    peerRef.current = peer;
    peer.on("open", (openId) => { setMyId(openId); setView("waiting"); });
    peer.on("connection", (conn) => { connRef.current = conn; setupConn(conn, true); setView("chat"); });
    peer.on("error", (e) => setStatusMsg("Error: " + e.message));
  };

  const joinRoom = () => {
    const roomId = joinInput.trim().toUpperCase();
    if (!roomId) return;
    const peer = new Peer();
    peerRef.current = peer;
    peer.on("open", () => {
      setStatusMsg("Connecting…");
      const conn = peer.connect(roomId, { reliable: true });
      connRef.current = conn;
      setupConn(conn, false);
    });
    peer.on("error", (e) => setStatusMsg("Error: " + e.message));
  };

  const sendMsg = () => {
    const text = msgInput.trim();
    if (!text || !connRef.current?.open) return;
    clearTimeout(typingTimerRef.current);
    myTypingRef.current = false;
    sendTypingSignal(false);
    const id = Date.now();
    const msg = { type: "text", text, id };
    connRef.current.send(msg);
    setMessages(prev => [...prev, { ...msg, from: "me", ts: new Date(), delivered: false }]);
    setMsgInput("");
  };

  const sendFile = async (file) => {
    setFileError("");
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File too large. Max ${formatBytes(MAX_FILE_SIZE)}.`);
      return;
    }
    if (!connRef.current?.open) return;
    const id = Date.now();
    const payload = await fileToChunks(file);
    payload.id = id;
    connRef.current.send(payload);
    setMessages(prev => [...prev, { ...payload, from: "me", ts: new Date(), delivered: false }]);
  };

  const disconnect = () => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
    setView("home");
    setMessages([]);
    setJoinInput("");
    setShowJoin(false);
    setStatusMsg("");
    setPeerTyping(false);
  };

  // ── Group messages by sender for avatar display ───────────────
  const groupedMessages = messages.map((msg, i) => ({
    ...msg,
    showAvatar: i === 0 || messages[i - 1].from !== msg.from,
    showDate: i === 0 || new Date(msg.ts).toDateString() !== new Date(messages[i - 1].ts).toDateString(),
  }));

  // ─── Views ────────────────────────────────────────────────────

  if (view === "home") return (
    <div style={s.page}>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
      <div style={s.card}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={s.title}>P2P Chat</h2>
          <p style={s.muted}>Direct, encrypted, serverless. No account needed.</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={s.btnPrimary} onClick={createRoom}>+ Create room</button>
          <button style={s.btnOutline} onClick={() => setShowJoin(v => !v)}>Join room</button>
        </div>

        {showJoin && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input style={s.input} placeholder="Paste room ID (e.g. AB12CD)"
              value={joinInput} onChange={e => setJoinInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && joinRoom()} autoFocus />
            <button style={s.btnPrimary} onClick={joinRoom}>Connect</button>
          </div>
        )}

        {statusMsg && <p style={{ ...s.muted, marginTop: 10, color: "#ef4444" }}>{statusMsg}</p>}

        <div style={{ marginTop: 24, padding: "14px 16px", background: "#f9fafb", borderRadius: 10, border: "0.5px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            🔒 Messages go directly between browsers via WebRTC.<br />
            Nothing is stored. Closing the tab ends the session.
          </p>
        </div>
      </div>
    </div>
  );

  if (view === "waiting") return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Room ready</h2>
        <p style={s.muted}>Share this ID with the person you want to chat with.</p>

        <div style={{
          display: "flex", gap: 10, alignItems: "center",
          background: "#f0f9ff", border: "0.5px solid #bae6fd",
          borderRadius: 10, padding: "12px 16px", margin: "16px 0",
        }}>
          <code style={{ flex: 1, fontSize: 22, fontFamily: "monospace", letterSpacing: "0.15em", color: "#0369a1" }}>
            {myId}
          </code>
          <CopyButton text={myId} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280", fontSize: 13 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#fbbf24",
            animation: "bounce 1.2s ease-in-out infinite",
          }} />
          Waiting for someone to join…
        </div>
        <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }`}</style>
      </div>
    </div>
  );

  if (view === "chat") return (
    <div style={s.chatContainer}>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>

      {/* Header */}
      <div style={s.chatHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>P2P Room · {myId}</p>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>End-to-end encrypted · files up to 20 MB</p>
          </div>
        </div>
        <button style={s.btnDanger} onClick={disconnect}>Leave</button>
      </div>

      {/* Messages */}
      <div style={s.messageArea}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60, color: "#9ca3af" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
            <p style={{ fontSize: 13 }}>Connection established. Say hello!</p>
          </div>
        )}

        {groupedMessages.map((msg) => (
          <div key={msg.id}>
            {msg.showDate && <DateDivider label={msg.ts.toDateString()} />}
            <ChatBubble msg={msg} showAvatar={msg.showAvatar} />
          </div>
        ))}

        {peerTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* File error */}
      {fileError && (
        <div style={{ padding: "6px 16px", background: "#fef2f2", fontSize: 12, color: "#ef4444" }}>
          {fileError}
        </div>
      )}

      {/* Input bar */}
      <div style={s.inputBar}>
        <input
          ref={fileInputRef} type="file" style={{ display: "none" }}
          onChange={e => { if (e.target.files[0]) sendFile(e.target.files[0]); e.target.value = ""; }}
        />
        <button style={s.iconBtn} title="Send file" onClick={() => fileInputRef.current.click()}>📎</button>
        <input
          style={{ ...s.input, flex: 1 }}
          placeholder="Message…"
          value={msgInput}
          onChange={handleInputChange}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMsg()}
        />
        <button style={s.btnPrimary} onClick={sendMsg} disabled={!msgInput.trim()}>Send</button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: 480, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui,sans-serif" },
  card: { background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "1.75rem" },
  chatContainer: {
    maxWidth: 480, margin: "1rem auto", fontFamily: "system-ui,sans-serif",
    background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14,
    display: "flex", flexDirection: "column", height: "calc(100vh - 2rem)", overflow: "hidden",
  },
  chatHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fff",
  },
  messageArea: {
    flex: 1, overflowY: "auto", padding: "12px 16px",
    display: "flex", flexDirection: "column",
  },
  inputBar: {
    display: "flex", gap: 8, alignItems: "center",
    padding: "10px 12px", borderTop: "0.5px solid #e5e7eb", background: "#fff",
  },
  title: { margin: "0 0 4px", fontSize: 20, fontWeight: 600, color: "#111827" },
  muted: { margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.5 },
  input: {
    padding: "9px 13px", borderRadius: 9, border: "0.5px solid #d1d5db",
    fontSize: 14, outline: "none", background: "#fff", color: "#111827",
  },
  btnPrimary: {
    padding: "9px 18px", borderRadius: 9, border: "none",
    background: "#2563eb", color: "#fff", fontSize: 14,
    cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap",
  },
  btnOutline: {
    padding: "9px 18px", borderRadius: 9, border: "0.5px solid #d1d5db",
    background: "#fff", color: "#374151", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
  },
  btnDanger: {
    padding: "6px 12px", borderRadius: 8, border: "0.5px solid #fca5a5",
    background: "#fff", color: "#ef4444", fontSize: 13, cursor: "pointer",
  },
  iconBtn: {
    padding: "6px 10px", borderRadius: 8, border: "0.5px solid #e5e7eb",
    background: "#f9fafb", fontSize: 16, cursor: "pointer", lineHeight: 1,
  },
};