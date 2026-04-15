// ── tk-shared.jsx — Shared UI primitives for all toolkit tools ────────────────
import { useState } from "react";

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
