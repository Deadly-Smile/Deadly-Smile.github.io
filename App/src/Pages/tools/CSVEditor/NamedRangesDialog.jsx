import { useState } from 'react';
import { colLabel, colIndex } from './utils.js';
import styles from './CSVEditor.module.css';

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RANGE_RE = /^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/;

const parseRange = (str) => {
  const m = RANGE_RE.exec(str.trim());
  if (!m) return null;
  return {
    r1: parseInt(m[2], 10) - 1,
    c1: colIndex(m[1].toUpperCase()),
    r2: parseInt(m[4], 10) - 1,
    c2: colIndex(m[3].toUpperCase()),
  };
};

const rangeToStr = ({ r1, c1, r2, c2 }) =>
  `${colLabel(c1)}${r1 + 1}:${colLabel(c2)}${r2 + 1}`;

const emptyForm = (defaultRange) => ({ name: '', rangeStr: defaultRange ?? '' });

export default function NamedRangesDialog({ namedRanges, defaultRange, onAdd, onUpdate, onRemove, onClose }) {
  const [form, setForm] = useState(emptyForm(defaultRange));
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const existingNames = new Set(
    namedRanges.filter((r) => r.id !== editingId).map((r) => r.name.toLowerCase())
  );

  const validate = () => {
    if (!NAME_RE.test(form.name))
      return 'Name must start with a letter or underscore, contain only letters, digits, or underscores.';
    if (existingNames.has(form.name.toLowerCase()))
      return `"${form.name}" is already defined.`;
    if (!parseRange(form.rangeStr))
      return 'Range must be in A1:B2 format.';
    return '';
  };

  const commit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    const range = parseRange(form.rangeStr);
    if (editingId) {
      onUpdate({ id: editingId, name: form.name, range });
    } else {
      onAdd({ id: crypto.randomUUID(), name: form.name, range });
    }
    setForm(emptyForm(defaultRange));
    setEditingId(null);
    setError('');
  };

  const startEdit = (nr) => {
    setEditingId(nr.id);
    setForm({ name: nr.name, rangeStr: rangeToStr(nr.range) });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm(defaultRange));
    setError('');
  };

  return (
    <div className={styles.cfOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.cfDialog} style={{ width: 440 }}>
        <div className={styles.cfHeader}>
          <span>Named Ranges</span>
          <button className={styles.cfClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.cfBody}>

          {/* Existing ranges list */}
          {namedRanges.length > 0 && (
            <div className={styles.cfRuleList} style={{ marginBottom: 12 }}>
              {namedRanges.map((nr) => (
                <div key={nr.id} className={styles.cfRuleItem}>
                  <div className={styles.cfRuleDesc}>
                    <strong>{nr.name}</strong>
                    <span style={{ marginLeft: 8, color: '#777', fontFamily: 'monospace', fontSize: 11 }}>
                      {rangeToStr(nr.range)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className={styles.cfRuleBtn} onClick={() => startEdit(nr)}>Edit</button>
                    <button className={styles.cfRuleBtnDanger} onClick={() => onRemove(nr.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {namedRanges.length === 0 && !editingId && (
            <p className={styles.cfEmpty}>No named ranges defined.</p>
          )}

          {/* Add / Edit form */}
          <div style={{ borderTop: namedRanges.length > 0 ? '1px solid #eee' : 'none', paddingTop: namedRanges.length > 0 ? 10 : 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className={styles.cfFieldLabel}>Name</label>
                <input
                  className={styles.cfField}
                  placeholder="e.g. Revenue"
                  value={form.name}
                  onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && commit()}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className={styles.cfFieldLabel}>Range</label>
                <input
                  className={styles.cfField}
                  placeholder="e.g. A1:C10"
                  value={form.rangeStr}
                  onChange={(e) => { setForm((f) => ({ ...f, rangeStr: e.target.value })); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && commit()}
                />
              </div>
            </div>

            {error && <p className={styles.cfHint} style={{ color: '#c62828' }}>{error}</p>}

            <div className={styles.cfFormActions}>
              <button className={styles.cfApplyBtn} onClick={commit}>
                {editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button className={styles.cfCancelBtn} onClick={cancelEdit}>Cancel</button>
              )}
            </div>

            <p className={styles.cfHint}>
              Use the name in formulas, e.g. <code>=SUM(Revenue)</code>.
              Names must start with a letter or underscore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
