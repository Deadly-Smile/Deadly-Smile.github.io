import { useState, useEffect, useRef } from 'react';
import styles from './CSVEditor.module.css';

export default function FilterDropdown({ colIdx, x, y, data, allowedValues, onApply, onClose }) {
  const allValues = [...new Set(data.map((row) => String(row[colIdx] ?? '')))].sort((a, b) =>
    a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)
  );

  const [checked, setChecked] = useState(() =>
    allowedValues ? new Set(allowedValues) : new Set(allValues)
  );
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const visible = allValues.filter((v) =>
    (v === '' ? '(empty)' : v).toLowerCase().includes(search.toLowerCase())
  );
  const allChecked = visible.length > 0 && visible.every((v) => checked.has(v));

  const toggle = (v) =>
    setChecked((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });

  const toggleAll = () =>
    setChecked(allChecked ? new Set([...checked].filter((v) => !visible.includes(v))) : new Set([...checked, ...visible]));

  const apply = () => {
    const isAll = checked.size >= allValues.length && allValues.every((v) => checked.has(v));
    onApply(colIdx, isAll ? null : [...checked]);
    onClose();
  };

  return (
    <div
      ref={ref}
      className={styles.filterDropdown}
      style={{ position: 'fixed', left: x, top: y, zIndex: 1000 }}
    >
      <input
        className={styles.filterSearch}
        placeholder="Search values…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <label className={styles.filterSelectAll}>
        <input type="checkbox" checked={allChecked} onChange={toggleAll} />
        <span>{allChecked ? 'Clear visible' : 'Select all visible'}</span>
      </label>
      <div className={styles.filterList}>
        {visible.map((v) => (
          <label key={v} className={styles.filterItem}>
            <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} />
            <span>{v === '' ? <em>(empty)</em> : v}</span>
          </label>
        ))}
        {visible.length === 0 && <span className={styles.filterNoMatch}>No matches</span>}
      </div>
      <div className={styles.filterActions}>
        <button className={styles.btn} onClick={apply}>Apply</button>
        <button className={styles.btn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
