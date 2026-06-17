import { useState } from 'react';
import styles from './CSVEditor.module.css';

export default function ExportDialog({ tabs, mode, onExport, onClose }) {
  const [selected, setSelected] = useState(() => new Set(tabs.map((t) => t.id)));

  const allChecked = tabs.length > 0 && tabs.every((t) => selected.has(t.id));

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(tabs.map((t) => t.id)));

  const handleExport = () => {
    const selectedTabs = tabs.filter((t) => selected.has(t.id));
    if (!selectedTabs.length) return;
    onExport(selectedTabs);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.cfOverlay} onClick={handleOverlayClick}>
      <div className={styles.cfDialog} style={{ width: 340 }}>
        <div className={styles.cfHeader}>
          <span>Export — {mode === 'xlsx' ? 'Excel (.xlsx)' : 'CSV'}</span>
          <button className={styles.cfClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.cfBody}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#555' }}>
            {mode === 'xlsx'
              ? 'Select sheets to include in the workbook:'
              : 'Select sheets to download (one .csv file each):'}
          </p>
          <div className={styles.cfRuleList}>
            <label
              className={styles.cfCheckLabel}
              style={{ padding: '5px 8px', borderBottom: '1px solid #e8e8e8', fontWeight: 600 }}
            >
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
              />
              All sheets
            </label>
            {tabs.map((tab) => (
              <label
                key={tab.id}
                className={styles.cfCheckLabel}
                style={{ padding: '4px 8px' }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(tab.id)}
                  onChange={() => toggle(tab.id)}
                />
                {tab.name}
              </label>
            ))}
          </div>
          <div className={styles.cfFormActions}>
            <button
              className={styles.cfApplyBtn}
              onClick={handleExport}
              disabled={selected.size === 0}
            >
              Export {selected.size} sheet{selected.size !== 1 ? 's' : ''}
            </button>
            <button className={styles.cfCancelBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
