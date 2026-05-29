import { useEffect } from "react";

const Modal = ({ title, onClose, width = "520px", actions, children }) => {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="tk-modal-overlay" onClick={onClose}>
      <div
        className="tk-modal-content tk-modal-shell"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="tk-modal-shell-header">
          <h2 className="tk-modal-shell-title">{title}</h2>
          <button className="tk-modal-shell-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="tk-modal-shell-body">
          {children}
        </div>

        {/* Footer */}
        {actions && (
          <div className="tk-modal-shell-footer">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;