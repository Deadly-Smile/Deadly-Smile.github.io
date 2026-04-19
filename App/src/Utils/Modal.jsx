import { useState, useCallback } from "react";

/**
 * Reusable Modal component for confirmations, inputs, and alerts
 */
export function Modal({ isOpen, title, children, onClose, actions = [] }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        animation: "tk-modal-fade-in 0.2s ease-out"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--tk-surface)",
          border: "1px solid var(--tk-border-bright)",
          borderRadius: "var(--tk-radius)",
          padding: "1.5rem",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          animation: "tk-modal-scale-in 0.2s ease-out"
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--tk-border)"
        }}>
          <h3 style={{
            margin: 0,
            fontSize: "1rem",
            letterSpacing: "0.1em",
            color: "var(--tk-text)",
            fontFamily: "var(--tk-mono)",
            fontWeight: 600
          }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--tk-text-dim)",
              cursor: "pointer",
              fontSize: "1.2em",
              padding: 0,
              transition: "color 0.2s"
            }}
            onMouseEnter={e => e.target.style.color = "var(--tk-text)"}
            onMouseLeave={e => e.target.style.color = "var(--tk-text-dim)"}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          marginBottom: "1.5rem",
          color: "var(--tk-text-dim)",
          fontSize: "0.85rem",
          lineHeight: 1.6
        }}>
          {children}
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div style={{
            display: "flex",
            gap: "0.8rem",
            justifyContent: "flex-end",
            flexWrap: "wrap"
          }}>
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => {
                  action.onClick?.();
                  if (action.closeOnClick !== false) onClose();
                }}
                style={{
                  background: action.primary ? "var(--tk-accent)" : "var(--tk-surface2)",
                  color: action.primary ? "var(--tk-bg)" : "var(--tk-text)",
                  border: action.danger ? "1px solid var(--tk-accent2)" : "1px solid var(--tk-border-bright)",
                  borderRadius: "var(--tk-radius)",
                  padding: "0.6rem 1.2rem",
                  cursor: "pointer",
                  fontFamily: "var(--tk-mono)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                  transition: "all 0.2s",
                  fontWeight: 600
                }}
                onMouseEnter={e => {
                  e.target.style.opacity = "0.8";
                  e.target.style.transform = "scale(1.02)";
                }}
                onMouseLeave={e => {
                  e.target.style.opacity = "1";
                  e.target.style.transform = "scale(1)";
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <style>{`
          @keyframes tk-modal-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes tk-modal-scale-in {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Hook to manage a single modal state
 */
export function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  const openModal = useCallback((data = null) => {
    setModalData(data);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setModalData(null);
  }, []);

  return { isOpen, modalData, openModal, closeModal };
}

/**
 * Modal variant for text input
 */
export function InputModal({ isOpen, title, placeholder, defaultValue = "", onClose, onSubmit }) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      actions={[
        {
          label: "Cancel",
          onClick: () => {}
        },
        {
          label: "Submit",
          primary: true,
          onClick: handleSubmit
        }
      ]}
    >
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyPress={handleKeyPress}
        autoFocus
        style={{
          width: "100%",
          padding: "0.8rem",
          background: "var(--tk-surface2)",
          border: "1px solid var(--tk-border-bright)",
          borderRadius: "var(--tk-radius)",
          color: "var(--tk-text)",
          fontFamily: "var(--tk-mono)",
          fontSize: "0.85rem",
          boxSizing: "border-box",
          transition: "border-color 0.2s"
        }}
        onFocus={e => e.target.style.borderColor = "var(--tk-accent)"}
        onBlur={e => e.target.style.borderColor = "var(--tk-border-bright)"}
      />
    </Modal>
  );
}

/**
 * Modal variant for confirmations
 */
export function ConfirmModal({ isOpen, title, message, onClose, onConfirm, danger = false }) {
  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      actions={[
        {
          label: "Cancel",
          onClick: () => {}
        },
        {
          label: "Confirm",
          primary: true,
          danger: danger,
          onClick: onConfirm
        }
      ]}
    >
      {message}
    </Modal>
  );
}
