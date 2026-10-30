import { useState, useEffect, memo } from "react";
import { formatBytes, initials } from "../format";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Avatar({ label, color, textColor = "#fff" }) {
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

// `data` is the session-only Blob/ArrayBuffer (history keeps just the
// name/mime/size); without it the bubble says the contents weren't kept.
function FilePreview({ msg, data, progress, isMe }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (data == null) { setUrl(null); return; }
    const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: msg.mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data, msg.mime]);

  const inProgress = progress !== undefined && progress < 1;
  const dim = isMe ? "var(--tk-bg)" : "var(--tk-text-dim)";

  if (data == null) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>📎</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{msg.name}</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {formatBytes(msg.size || 0)}{inProgress ? "" : " · contents not kept in history"}
            </div>
          </div>
        </div>
        {inProgress && <ProgressBar progress={progress} isMe={isMe} label="Receiving" />}
      </div>
    );
  }
  if (!url) return null;

  if (msg.mime?.startsWith("image/")) return (
    <div>
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={msg.name}
          style={{ maxWidth: 200, maxHeight: 160, borderRadius: 8, display: "block", cursor: "pointer" }} />
      </a>
      {inProgress && <ProgressBar progress={progress} isMe={isMe} label="Sending" />}
    </div>
  );

  if (msg.mime?.startsWith("audio/")) return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: dim }}>{msg.name}</p>
      <audio controls src={url} style={{ maxWidth: 220 }} />
      {inProgress && <ProgressBar progress={progress} isMe={isMe} label="Sending" />}
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
      {inProgress && <ProgressBar progress={progress} isMe={isMe} label="Sending" />}
    </div>
  );
}

const STATUS_MARK = { queued: "🕓", sent: "✓", delivered: "✓✓" };
const STATUS_TITLE = { queued: "Waiting — sends when they're online", sent: "Sent", delivered: "Delivered" };

export const ChatBubble = memo(function ChatBubble({ msg, data, progress, showAvatar, peerLabel, onDelete }) {
  const isMe = msg.from === "me";
  return (
    <div className="p2pchat-msg" style={{
      display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 2,
      flexDirection: isMe ? "row-reverse" : "row",
    }}>
      {showAvatar
        ? <Avatar label={isMe ? "Me" : initials(peerLabel)} color={isMe ? "var(--tk-accent)" : "var(--tk-info)"} textColor={isMe ? "var(--tk-bg)" : "#fff"} />
        : <div style={{ width: 28 }} />}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 2, alignItems: isMe ? "flex-end" : "flex-start" }}>
        <div style={{
          padding: msg.type === "file" ? "10px 12px" : "9px 13px",
          borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isMe ? "var(--tk-accent)" : "var(--tk-surface2)",
          color: isMe ? "var(--tk-bg)" : "var(--tk-text)",
          opacity: msg.status === "queued" ? 0.7 : 1,
          fontSize: 14, lineHeight: 1.55, wordBreak: "break-word",
          whiteSpace: msg.type === "text" ? "pre-wrap" : "normal",
        }}>
          {msg.type === "text" ? msg.text : <FilePreview msg={msg} data={data} progress={progress} isMe={isMe} />}
        </div>
        <span style={{ fontSize: 11, color: "var(--tk-text-dim)", paddingInline: 4 }}>
          {formatTime(msg.ts)}
          {isMe && (
            <span title={STATUS_TITLE[msg.status]} style={{ marginLeft: 4, color: msg.status === "delivered" ? "var(--tk-accent)" : "var(--tk-text-dim)" }}>
              {STATUS_MARK[msg.status] ?? "✓"}
            </span>
          )}
        </span>
      </div>
      <button className="p2pchat-del" type="button" title="Delete message (on this device)"
        onClick={() => onDelete(msg.id)}
        style={{ alignSelf: "center", background: "transparent", border: "none", color: "var(--tk-text-dim)", cursor: "pointer", fontSize: 12, padding: 4 }}>
        ✕
      </button>
    </div>
  );
});

export const DateDivider = memo(function DateDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px" }}>
      <div style={{ flex: 1, height: "0.5px", background: "var(--tk-border)" }} />
      <span style={{ fontSize: 11, color: "var(--tk-text-dim)", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: "0.5px", background: "var(--tk-border)" }} />
    </div>
  );
});

export function TypingIndicator({ peerLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 4 }}>
      <Avatar label={initials(peerLabel)} color="var(--tk-info)" />
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
