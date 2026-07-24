import { useState, useCallback, useEffect } from "react";

/**
 * Reusable Modal component for confirmations, inputs, and alerts.
 * `actions` accepts either an array of action descriptors
 * ({label, onClick, primary, danger, closeOnClick}) or a plain ReactNode
 * rendered as-is in the footer.
 */
export function Modal({ isOpen = true, title, children, onClose, actions = [], width = "500px" }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actionButtons = Array.isArray(actions) ? actions : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] animate-modal-fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: width }}
        className="bg-tk-surface border border-tk-border-bright rounded-tk p-6 w-[90%] max-h-[80vh] overflow-y-auto shadow-2xl animate-modal-scale-in font-tk-mono"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-tk-border">
          <h3 className="m-0 text-base tracking-[0.1em] text-tk-text font-semibold">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-tk-text-dim hover:text-tk-text cursor-pointer text-xl p-0 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="mb-6 text-tk-text-dim text-sm leading-relaxed">
          {children}
        </div>

        {/* Actions */}
        {actionButtons ? (
          actionButtons.length > 0 && (
            <div className="flex gap-3 justify-end flex-wrap">
              {actionButtons.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    action.onClick?.();
                    if (action.closeOnClick !== false) onClose();
                  }}
                  className={`rounded-tk px-5 py-2.5 cursor-pointer font-tk-mono text-xs tracking-[0.08em] font-semibold transition-all hover:opacity-80 hover:scale-[1.02] ${
                    action.primary ? "bg-tk-accent text-tk-bg" : "bg-tk-surface2 text-tk-text"
                  } ${action.danger ? "border border-tk-accent2" : "border border-tk-border-bright"}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="flex gap-3 justify-end flex-wrap">{actions}</div>
        )}
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
        className="w-full p-3 bg-tk-surface2 border border-tk-border-bright rounded-tk text-tk-text font-tk-mono text-sm box-border transition-colors focus:border-tk-accent focus:outline-none"
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

export default Modal;
