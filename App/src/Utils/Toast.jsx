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
    <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-[9999] pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

const TYPE_STYLES = {
  success: { classes: "bg-tk-accent/10 border-tk-accent/30 text-tk-accent", icon: "✓" },
  error: { classes: "bg-tk-accent2/10 border-tk-accent2/30 text-tk-accent2", icon: "✗" },
  warning: { classes: "bg-tk-accent3/10 border-tk-accent3/30 text-tk-accent3", icon: "⚠" },
  info: { classes: "bg-tk-info/10 border-tk-info/30 text-tk-info", icon: "ℹ" },
};

function ToastItem({ toast, onRemove }) {
  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  return (
    <div
      className={`${style.classes} border rounded-tk py-3 px-4 font-tk-mono text-xs flex items-center gap-2.5 animate-toast-slide-in shadow-lg pointer-events-auto max-w-[300px] break-words`}
    >
      <span className="text-lg flex-shrink-0">{style.icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="bg-transparent border-none cursor-pointer text-base p-0 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: "inherit" }}
      >
        ✕
      </button>
    </div>
  );
}
