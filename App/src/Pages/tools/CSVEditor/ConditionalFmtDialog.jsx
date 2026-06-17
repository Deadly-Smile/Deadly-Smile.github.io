import { useState } from 'react';
import { colLabel, colIndex } from './utils.js';
import styles from './CSVEditor.module.css';

const CONDITION_TYPES = [
  { value: 'greater_than',  label: 'Greater than'              },
  { value: 'less_than',     label: 'Less than'                 },
  { value: 'greater_eq',    label: 'Greater than or equal to'  },
  { value: 'less_eq',       label: 'Less than or equal to'     },
  { value: 'equal_to',      label: 'Equal to'                  },
  { value: 'not_equal',     label: 'Not equal to'              },
  { value: 'between',       label: 'Between'                   },
  { value: 'contains',      label: 'Contains text'             },
  { value: 'not_contains',  label: 'Does not contain text'     },
  { value: 'is_empty',      label: 'Is empty'                  },
  { value: 'not_empty',     label: 'Is not empty'              },
  { value: 'row_even',      label: 'Row is even (2, 4, 6 …)'  },
  { value: 'row_odd',       label: 'Row is odd (1, 3, 5 …)'   },
];

const NO_VALUE = new Set(['is_empty', 'not_empty', 'row_even', 'row_odd']);
const TWO_VALUE = new Set(['between']);

const parseRangeStr = (str) => {
  const m = str.trim().toUpperCase().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return null;
  return {
    r1: parseInt(m[2], 10) - 1,
    c1: colIndex(m[1]),
    r2: parseInt(m[4], 10) - 1,
    c2: colIndex(m[3]),
  };
};

const rangeToStr = (range) =>
  range ? `${colLabel(range.c1)}${range.r1 + 1}:${colLabel(range.c2)}${range.r2 + 1}` : '';

const condSummary = (condition) => {
  const ct = CONDITION_TYPES.find((t) => t.value === condition.type);
  const label = ct?.label ?? condition.type;
  if (NO_VALUE.has(condition.type) || TWO_VALUE.has(condition.type) === false && condition.value === '')
    return label;
  if (TWO_VALUE.has(condition.type)) return `${label}: ${condition.value} – ${condition.value2}`;
  return `${label}: ${condition.value}`;
};

const BLANK_FORM = {
  id: null, rangeStr: '', allCells: true,
  condType: 'greater_than', value: '', value2: '',
  bg: '#ffcccc', color: '', bold: false, italic: false,
};

export default function ConditionalFmtDialog({ rules, selection, onAdd, onUpdate, onRemove, onClose }) {
  const [form, setForm] = useState(null);
  const [rangeErr, setRangeErr] = useState('');

  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  const openAdd = () => {
    const { anchor, active } = selection;
    const r1 = Math.min(anchor.row, active.row);
    const c1 = Math.min(anchor.col, active.col);
    const r2 = Math.max(anchor.row, active.row);
    const c2 = Math.max(anchor.col, active.col);
    const single = r1 === r2 && c1 === c2;
    setForm({ ...BLANK_FORM, allCells: single, rangeStr: single ? '' : rangeToStr({ r1, c1, r2, c2 }) });
    setRangeErr('');
  };

  const openEdit = (rule) => {
    setForm({
      id: rule.id,
      rangeStr: rangeToStr(rule.range),
      allCells: !rule.range,
      condType: rule.condition.type,
      value: rule.condition.value ?? '',
      value2: rule.condition.value2 ?? '',
      bg: rule.style.bg ?? '',
      color: rule.style.color ?? '',
      bold: rule.style.bold ?? false,
      italic: rule.style.italic ?? false,
    });
    setRangeErr('');
  };

  const handleSave = () => {
    let range = null;
    if (!form.allCells) {
      if (!form.rangeStr.trim()) { setRangeErr('Enter a range like A1:D10'); return; }
      range = parseRangeStr(form.rangeStr);
      if (!range) { setRangeErr('Invalid range — use format A1:D10'); return; }
    }
    const rule = {
      id: form.id ?? crypto.randomUUID(),
      range,
      condition: { type: form.condType, value: form.value, value2: form.value2 },
      style: {
        bg: form.bg || undefined,
        color: form.color || undefined,
        bold: form.bold || undefined,
        italic: form.italic || undefined,
      },
    };
    form.id ? onUpdate(rule) : onAdd(rule);
    setForm(null);
  };

  return (
    <div className={styles.cfOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.cfDialog}>
        <div className={styles.cfHeader}>
          <span>Conditional Formatting</span>
          <button className={styles.cfClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.cfBody}>
          {rules.length === 0 && !form && (
            <p className={styles.cfEmpty}>No rules yet. Click "Add Rule" to start.</p>
          )}

          {rules.length > 0 && (
            <ul className={styles.cfRuleList}>
              {rules.map((rule) => (
                <li key={rule.id} className={styles.cfRuleItem}>
                  <span
                    className={styles.cfSwatch}
                    style={{ background: rule.style.bg || 'transparent', border: rule.style.bg ? 'none' : '1px solid #ccc' }}
                  />
                  <span className={styles.cfRuleDesc}>
                    <strong>{rule.range ? rangeToStr(rule.range) : 'All cells'}</strong>
                    {' — '}
                    {condSummary(rule.condition)}
                  </span>
                  <button className={styles.cfRuleBtn} onClick={() => openEdit(rule)}>Edit</button>
                  <button className={styles.cfRuleBtn} onClick={() => onRemove(rule.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}

          {form && (
            <div className={styles.cfForm}>
              <div className={styles.cfFormTitle}>{form.id ? 'Edit Rule' : 'New Rule'}</div>

              <label className={styles.cfCheckLabel}>
                <input
                  type="checkbox"
                  checked={form.allCells}
                  onChange={(e) => setF({ allCells: e.target.checked, rangeStr: '' })}
                />
                Apply to all cells
              </label>

              {!form.allCells && (
                <div className={styles.cfField}>
                  <span className={styles.cfFieldLabel}>Range</span>
                  <input
                    className={[styles.cfInput, rangeErr ? styles.cfInputError : ''].filter(Boolean).join(' ')}
                    value={form.rangeStr}
                    onChange={(e) => { setF({ rangeStr: e.target.value }); setRangeErr(''); }}
                    placeholder="e.g. A1:D10"
                  />
                  {rangeErr && <span className={styles.cfErrMsg}>{rangeErr}</span>}
                </div>
              )}

              <div className={styles.cfField}>
                <span className={styles.cfFieldLabel}>Condition</span>
                <select
                  className={styles.cfSelect}
                  value={form.condType}
                  onChange={(e) => setF({ condType: e.target.value })}
                >
                  {CONDITION_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {!NO_VALUE.has(form.condType) && (
                <div className={styles.cfField}>
                  <span className={styles.cfFieldLabel}>{TWO_VALUE.has(form.condType) ? 'From' : 'Value'}</span>
                  <input
                    className={styles.cfInput}
                    value={form.value}
                    onChange={(e) => setF({ value: e.target.value })}
                    placeholder={TWO_VALUE.has(form.condType) ? 'min value' : 'value'}
                  />
                </div>
              )}

              {TWO_VALUE.has(form.condType) && (
                <div className={styles.cfField}>
                  <span className={styles.cfFieldLabel}>To</span>
                  <input
                    className={styles.cfInput}
                    value={form.value2}
                    onChange={(e) => setF({ value2: e.target.value })}
                    placeholder="max value"
                  />
                </div>
              )}

              <div className={styles.cfField}>
                <span className={styles.cfFieldLabel}>Style</span>
                <div className={styles.cfStyleRow}>
                  <label className={styles.cfStyleItem} title="Background colour">
                    Bg
                    <input
                      type="color"
                      value={form.bg || '#ffffff'}
                      onChange={(e) => setF({ bg: e.target.value })}
                    />
                    {form.bg && (
                      <button className={styles.cfColorClear} onClick={() => setF({ bg: '' })}>✕</button>
                    )}
                  </label>
                  <label className={styles.cfStyleItem} title="Text colour">
                    Text
                    <input
                      type="color"
                      value={form.color || '#000000'}
                      onChange={(e) => setF({ color: e.target.value })}
                    />
                    {form.color && (
                      <button className={styles.cfColorClear} onClick={() => setF({ color: '' })}>✕</button>
                    )}
                  </label>
                  <label className={styles.cfStyleItem}>
                    <input type="checkbox" checked={form.bold} onChange={(e) => setF({ bold: e.target.checked })} />
                    <strong>B</strong>
                  </label>
                  <label className={styles.cfStyleItem}>
                    <input type="checkbox" checked={form.italic} onChange={(e) => setF({ italic: e.target.checked })} />
                    <em>I</em>
                  </label>
                </div>
              </div>

              <div className={styles.cfFormActions}>
                <button className={styles.cfApplyBtn} onClick={handleSave}>
                  {form.id ? 'Save changes' : 'Add rule'}
                </button>
                <button className={styles.cfCancelBtn} onClick={() => { setForm(null); setRangeErr(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.cfFooter}>
          {!form && (
            <button className={styles.cfAddBtn} onClick={openAdd}>+ Add Rule</button>
          )}
        </div>
      </div>
    </div>
  );
}
