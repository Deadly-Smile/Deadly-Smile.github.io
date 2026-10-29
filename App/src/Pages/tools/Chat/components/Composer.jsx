import { useState, useEffect, useRef } from "react";
import { s } from "../styles";
import { formatBytes } from "../format";
import { MAX_FILE_SIZE } from "../transfer";

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
// (potentially long) chat history above it. Keyed by peer in Chat.jsx, so a
// draft never leaks into another conversation.
// Files need a live link (their bytes aren't stored), text can be queued.
export function MessageComposer({ onSendText, onSendFile, onTyping, canSendFile, placeholder }) {
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

  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

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
    if (!pendingFile || !canSendFile) return;
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
        <button style={{ ...s.iconBtn, opacity: canSendFile ? 1 : 0.4 }} disabled={!canSendFile}
          title={canSendFile ? "Send file" : "Files can only be sent while connected"}
          onClick={() => fileInputRef.current.click()}>📎</button>
        <textarea
          ref={textareaRef}
          rows={1}
          style={s.textarea}
          placeholder={placeholder}
          value={msgInput}
          onChange={handleInputChange}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button style={s.btnPrimary} onClick={handleSend} disabled={!msgInput.trim()}>Send</button>
      </div>
    </div>
  );
}
