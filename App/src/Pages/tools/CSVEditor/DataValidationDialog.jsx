import { useState } from 'react';
import { colLabel, colIndex } from './utils.js';
import styles from './CSVEditor.module.css';

const RULE_TYPES = [
  { value: 'list',        label: 'List of values' },
  { value: 'number',      label: 'Number' },
  { value: 'text_length', label: 'Text length' },
  { value: 'custom',      label: 'Custom formula' },
];

const OPS = [
  { value: 'between', label: 'between' },
  { value: 'gt',      label: 'greater than' },
  { value: 'gte',     label: 'greater than or equal' },
  { value: 'lt',      label: 'less than' },
  { value: 'lte',     label: 'less than or equal' },
  { value: 'eq',      label: 'equal to' },
  { value: 'neq',     label: 'not equal to' },
];

const TWO_VAL = new Set(['between']);

const rangeToStr = (range) => {
  if (!range) return 'All';
  return `${colLabel(range.c1)}${range.r1 + 1}:${colLabel(range.c2)}${range.r2 + 1}`;
};

const parseRange = (str) => {
  if (!str || str.toLowerCase() === 'all' || str.trim() === '') return null;
  const m = str.trim().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const r1 = parseInt(m[2], 10) - 1, r2 = parseInt(m[4], 10) - 1;
  const c1 = colIndex(m[1].toUpperCase()), c2 = colIndex(m[3].toUpperCase());
  if (isNaN(r1) || isNaN(r2) || c1 < 0 || c2 < 0) return null;
  return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
};

const blankForm = (rangeStr = 'All') => ({
  id: null, rangeStr, ruleType: 'list',
  listValues: '', op: 'between', min: '', max: '', formula: '',
  errorStyle: 'stop', errorMsg: '',
});

const ruleSummary = (rule) => {
  if (!rule) return '';
  switch (rule.type) {
    case 'list':        return `[${(rule.values ?? []).join(', ')}]`;
    case 'number':      return `number ${rule.op} ${rule.min}${TWO_VAL.has(rule.op) ? ` – ${rule.max}` : ''}`;
    case 'text_length': return `length ${rule.op} ${rule.min}${TWO_VAL.has(rule.op) ? ` – ${rule.max}` : ''}`;
    case 'custom':      return `formula: ${rule.formula}`;
    default:            return rule.type;
  }
};

export default function DataValidationDialog({ rules, selection, onAdd, onUpdate, onRemove, onClose }) {
  const [form, setForm] = useState(() => {
    const { anchor, active } = selection;
    const r1 = Math.min(anchor.row, active.row), r2 = Math.max(anchor.row, active.row);
    const c1 = Math.min(anchor.col, active.col), c2 = Math.max(anchor.col, active.col);
    const rangeStr = (r1 === 0 && c1 === 0 && r2 === 0 && c2 === 0)
      ? 'All'
      : `${colLabel(c1)}${r1 + 1}:${colLabel(c2)}${r2 + 1}`;
    return blankForm(rangeStr);
  });
  const [editing, setEditing] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleEdit = (vRule) => {
    const { range, rule: r, errorStyle, errorMsg = '' } = vRule;
    setForm({
      id: vRule.id,
      rangeStr: rangeToStr(range),
      ruleType: r.type,
      listValues: r.type === 'list' ? (r.values ?? []).join(', ') : '',
      op: r.op ?? 'between',
      min: r.min ?? '',
      max: r.max ?? '',
      formula: r.formula ?? '',
      errorStyle: errorStyle ?? 'stop',
      errorMsg,
    });
    setEditing(true);
  };

  const buildPayload = () => {
    const range = parseRange(form.rangeStr);
    let rule;
    if (form.ruleType === 'list') {
      rule = { type: 'list', values: form.listValues.split(',').map((v) => v.trim()).filter(Boolean) };
    } else if (form.ruleType === 'number' || form.ruleType === 'text_length') {
      rule = { type: form.ruleType, op: form.op, min: form.min, max: form.max };
    } else {
      rule = { type: 'custom', formula: form.formula };
    }
    return { range, rule, errorStyle: form.errorStyle, errorMsg: form.errorMsg };
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (form.id) onUpdate({ ...payload, id: form.id });
    else          onAdd({ ...payload, id: crypto.randomUUID() });
    setForm(blankForm());
    setEditing(false);
  };

  const handleCancel = () => { setForm(blankForm()); setEditing(false); };

  return (
    <div className={styles.cfOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.cfDialog} style={{ width: 480 }}>

        {/* Header */}
        <div className={styles.cfHeader}>
          <span>Data Validation</span>
          <button className={styles.cfClose} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.cfBody}>

          {/* Rule list */}
          <div className={styles.cfRuleList}>
            {rules.length === 0 && !editing && (
              <div className={styles.cfEmpty}>No rules yet — click "+ Add rule" to create one.</div>
            )}
            {rules.map((vRule) => (
              <div key={vRule.id} className={styles.cfRuleItem}>
                <span className={styles.cfRuleDesc}>
                  <strong>{rangeToStr(vRule.range)}</strong>
                  {' · '}
                  {ruleSummary(vRule.rule)}
                  {' · '}
                  <em>{vRule.errorStyle}</em>
                </span>
                <button
                  className={styles.cfRuleBtn}
                  onClick={() => handleEdit(vRule)}
                >
                  Edit
                </button>
                <button
                  className={[styles.cfRuleBtn, styles.cfRuleBtnDanger].join(' ')}
                  onClick={() => onRemove(vRule.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add button (shown when not editing) */}
          {!editing && (
            <button className={styles.cfAddBtn} onClick={() => setEditing(true)}>
              + Add rule
            </button>
          )}

          {/* Add / Edit form */}
          {editing && (
            <div className={styles.cfForm}>

              <div className={styles.cfField}>
                <label className={styles.cfFieldLabel}>
                  Range
                  <span className={styles.cfHint}>e.g. A1:C10 · "All" = entire sheet</span>
                </label>
                <input
                  className={styles.cfInput}
                  value={form.rangeStr}
                  onChange={(e) => set('rangeStr', e.target.value)}
                  placeholder="All"
                />
              </div>

              <div className={styles.cfField}>
                <label className={styles.cfFieldLabel}>Validation type</label>
                <select
                  className={styles.cfSelect}
                  value={form.ruleType}
                  onChange={(e) => set('ruleType', e.target.value)}
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {form.ruleType === 'list' && (
                <div className={styles.cfField}>
                  <label className={styles.cfFieldLabel}>
                    Allowed values
                    <span className={styles.cfHint}>comma-separated</span>
                  </label>
                  <input
                    className={styles.cfInput}
                    value={form.listValues}
                    onChange={(e) => set('listValues', e.target.value)}
                    placeholder="Apple, Banana, Cherry"
                  />
                </div>
              )}

              {(form.ruleType === 'number' || form.ruleType === 'text_length') && (
                <>
                  <div className={styles.cfField}>
                    <label className={styles.cfFieldLabel}>Operator</label>
                    <select
                      className={styles.cfSelect}
                      value={form.op}
                      onChange={(e) => set('op', e.target.value)}
                    >
                      {OPS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className={styles.cfField} style={{ flex: 1 }}>
                      <label className={styles.cfFieldLabel}>
                        {TWO_VAL.has(form.op) ? 'Minimum' : 'Value'}
                      </label>
                      <input
                        className={styles.cfInput}
                        type="number"
                        value={form.min}
                        onChange={(e) => set('min', e.target.value)}
                      />
                    </div>
                    {TWO_VAL.has(form.op) && (
                      <div className={styles.cfField} style={{ flex: 1 }}>
                        <label className={styles.cfFieldLabel}>Maximum</label>
                        <input
                          className={styles.cfInput}
                          type="number"
                          value={form.max}
                          onChange={(e) => set('max', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {form.ruleType === 'custom' && (
                <div className={styles.cfField}>
                  <label className={styles.cfFieldLabel}>
                    Formula
                    <span className={styles.cfHint}>must return TRUE / FALSE</span>
                  </label>
                  <input
                    className={styles.cfInput}
                    value={form.formula}
                    onChange={(e) => set('formula', e.target.value)}
                    placeholder="=AND(A1>0, A1<100)"
                  />
                </div>
              )}

              <div className={styles.cfField}>
                <label className={styles.cfFieldLabel}>On invalid input</label>
                <div className={styles.cfStyleRow}>
                  <label className={styles.cfCheckLabel}>
                    <input
                      type="radio"
                      checked={form.errorStyle === 'stop'}
                      onChange={() => set('errorStyle', 'stop')}
                    />
                    Stop — reject value
                  </label>
                  <label className={styles.cfCheckLabel}>
                    <input
                      type="radio"
                      checked={form.errorStyle === 'warning'}
                      onChange={() => set('errorStyle', 'warning')}
                    />
                    Warning — allow but notify
                  </label>
                </div>
              </div>

              <div className={styles.cfField}>
                <label className={styles.cfFieldLabel}>
                  Error message
                  <span className={styles.cfHint}>optional</span>
                </label>
                <input
                  className={styles.cfInput}
                  value={form.errorMsg}
                  onChange={(e) => set('errorMsg', e.target.value)}
                  placeholder="Please enter a valid value."
                />
              </div>

              <div className={styles.cfFormActions}>
                <button className={styles.cfApplyBtn} onClick={handleSave}>
                  {form.id ? 'Update rule' : 'Add rule'}
                </button>
                <button className={styles.cfCancelBtn} onClick={handleCancel}>
                  Cancel
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
