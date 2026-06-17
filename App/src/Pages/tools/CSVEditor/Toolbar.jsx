import { useRef, useState, useEffect } from 'react';
import styles from './CSVEditor.module.css';

const DELIMITERS = [
  { value: 'auto', label: 'Auto' },
  { value: ',',    label: ',' },
  { value: ';',    label: ';' },
  { value: '\t',   label: 'TAB' },
  { value: '|',    label: '|' },
];

const QUOTES = [
  { value: '"', label: '" double' },
  { value: "'", label: "' single" },
];

const delimLabel = (d) => {
  if (!d || d === 'auto') return 'Auto';
  if (d === '\t') return 'TAB';
  return d;
};

function DialectPopover({ x, y, dialect, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={styles.dialectPopover}
      style={{ position: 'fixed', left: x, top: y, zIndex: 1000 }}
    >
      <div className={styles.dialectSection}>
        <span className={styles.dialectLabel}>Delimiter</span>
        <div className={styles.dialectChips}>
          {DELIMITERS.map((d) => (
            <button
              key={d.value}
              className={[
                styles.dialectChip,
                dialect.delimiter === d.value ? styles.dialectChipActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onChange({ delimiter: d.value })}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.dialectSection}>
        <span className={styles.dialectLabel}>Quote character</span>
        <div className={styles.dialectChips}>
          {QUOTES.map((q) => (
            <button
              key={q.value}
              className={[
                styles.dialectChip,
                dialect.quoteChar === q.value ? styles.dialectChipActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onChange({ quoteChar: q.value })}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Toolbar({
  onFileSelected, onSave, onSaveXlsx, hasData, savedAt, storageFull, onHelpOpen,
  filterEnabled, onFilterToggle, onValidationOpen, onChartOpen, onNamesOpen,
  darkMode, onDarkToggle,
  dialect = { delimiter: 'auto', quoteChar: '"' }, onDialectChange,
}) {
  const fileInputRef = useRef(null);
  const dialectBtnRef = useRef(null);
  const [dialectOpen, setDialectOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  const statusLabel = storageFull
    ? '⚠ Storage full — download to avoid losing work'
    : savedAt
    ? 'Auto-saved'
    : '';

  const openDialect = () => {
    const rect = dialectBtnRef.current?.getBoundingClientRect();
    if (rect) setPopoverPos({ x: rect.left, y: rect.bottom + 4 });
    setDialectOpen((v) => !v);
  };

  return (
    <div className={styles.toolbar}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
        className={styles.fileInput}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) onFileSelected(file);
          e.target.value = '';
        }}
      />
      <button className={styles.btn} onClick={() => fileInputRef.current?.click()}>
        Import
      </button>
      <button className={styles.btn} onClick={onSave} disabled={!hasData}>
        Save CSV
      </button>
      <button className={styles.btn} onClick={onSaveXlsx} disabled={!hasData} title="Export all sheets as .xlsx">
        Save XLSX
      </button>
      <button
        ref={dialectBtnRef}
        className={[styles.btn, dialectOpen ? styles.btnActive : ''].filter(Boolean).join(' ')}
        onClick={openDialect}
        title="CSV dialect settings"
      >
        {delimLabel(dialect.delimiter)} ▾
      </button>
      {statusLabel && (
        <span className={storageFull ? styles.toolbarStorageFull : styles.toolbarStatus}>
          {statusLabel}
        </span>
      )}
      <button
        className={styles.btn}
        onClick={onChartOpen}
        disabled={!hasData}
        title="Insert chart from selection"
        style={{ marginLeft: 'auto' }}
      >
        Chart
      </button>
      <button
        className={styles.btn}
        onClick={onNamesOpen}
        title="Manage named ranges"
      >
        Names
      </button>
      <button
        className={styles.btn}
        onClick={onValidationOpen}
        title="Data Validation Rules"
      >
        Validate
      </button>
      <button
        className={[styles.btn, filterEnabled ? styles.btnActive : ''].filter(Boolean).join(' ')}
        onClick={onFilterToggle}
        title="Toggle AutoFilter"
      >
        Filter
      </button>
      <button
        className={styles.btn}
        onClick={onDarkToggle}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? 'Light' : 'Dark'}
      </button>
      <button className={styles.helpBtn} onClick={onHelpOpen} title="Help & Reference">?</button>

      {dialectOpen && (
        <DialectPopover
          x={popoverPos.x}
          y={popoverPos.y}
          dialect={dialect}
          onChange={(partial) => { onDialectChange?.(partial); }}
          onClose={() => setDialectOpen(false)}
        />
      )}
    </div>
  );
}
