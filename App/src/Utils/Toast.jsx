import { useState, useEffect, useCallback } from "react";

// Toast context to manage multiple toasts
let toastId = 0;
const toastListeners = new Set();

export function showToast(message, type = "info", duration = 3000) {
  const id = toastId++;
  const toast = { id, message, type, duration };
  toastListeners.forEach(listener => listener(toast));
  return id;
}

export function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNewToast = (toast) => {
      setToasts(prev => [...prev, toast]);
      if (toast.duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, toast.duration);
      }
    };

    toastListeners.add(handleNewToast);
    return () => toastListeners.delete(handleNewToast);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div style={{
      position: "fixed",
      bottom: "2rem",
      right: "2rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.8rem",
      zIndex: 9999,
      pointerEvents: "none"
    }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const typeStyles = {
    success: {
      bg: "rgba(0, 255, 136, 0.1)",
      border: "1px solid rgba(0, 255, 136, 0.3)",
      text: "#00ff88",
      icon: "✓"
    },
    error: {
      bg: "rgba(255, 51, 102, 0.1)",
      border: "1px solid rgba(255, 51, 102, 0.3)",
      text: "#ff3366",
      icon: "✗"
    },
    warning: {
      bg: "rgba(255, 204, 0, 0.1)",
      border: "1px solid rgba(255, 204, 0, 0.3)",
      text: "#ffcc00",
      icon: "⚠"
    },
    info: {
      bg: "rgba(74, 144, 226, 0.1)",
      border: "1px solid rgba(74, 144, 226, 0.3)",
      text: "#4a90e2",
      icon: "ℹ"
    }
  };

  const style = typeStyles[toast.type] || typeStyles.info;

  return (
    <div
      style={{
        background: style.bg,
        border: style.border,
        borderRadius: "var(--tk-radius)",
        padding: "0.8rem 1rem",
        color: style.text,
        fontFamily: "var(--tk-mono)",
        fontSize: "0.75rem",
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        animation: "tk-toast-slide-in 0.3s ease-out",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        pointerEvents: "auto",
        maxWidth: "300px",
        wordBreak: "break-word"
      }}
    >
      <span style={{ fontSize: "1.1em", flexShrink: 0 }}>{style.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: "none",
          border: "none",
          color: style.text,
          cursor: "pointer",
          fontSize: "1em",
          padding: 0,
          flexShrink: 0,
          opacity: 0.6,
          transition: "opacity 0.2s"
        }}
        onMouseEnter={e => e.target.style.opacity = "1"}
        onMouseLeave={e => e.target.style.opacity = "0.6"}
      >
        ✕
      </button>
      <style>{`
        @keyframes tk-toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
