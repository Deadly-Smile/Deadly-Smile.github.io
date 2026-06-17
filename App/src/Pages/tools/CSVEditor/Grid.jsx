import { useRef, useState, useEffect, useMemo } from 'react';
import { colLabel } from './utils.js';
import { isFormulaError, formulaErrorTitle } from './formula.js';
import ContextMenu from './ContextMenu.jsx';
import styles from './CSVEditor.module.css';

const ROW_NUM_WIDTH = 50;
const DEFAULT_COL_WIDTH = 100;

const evaluateCondition = (displayVal, { type, value, value2 }, row) => {
  const n = Number(displayVal);
  const isNum = displayVal !== '' && displayVal != null && !isNaN(n);
  const str = String(displayVal ?? '');
  const t = Number(value);
  const t2 = Number(value2);
  switch (type) {
    case 'greater_than':  return isNum && n > t;
    case 'less_than':     return isNum && n < t;
    case 'greater_eq':    return isNum && n >= t;
    case 'less_eq':       return isNum && n <= t;
    case 'equal_to':      return str === String(value) || (isNum && !isNaN(t) && n === t);
    case 'not_equal':     return str !== String(value) && !(isNum && !isNaN(t) && n === t);
    case 'between':       return isNum && n >= Math.min(t, t2) && n <= Math.max(t, t2);
    case 'contains':      return str.includes(String(value));
    case 'not_contains':  return !str.includes(String(value));
    case 'is_empty':      return str === '' || displayVal == null;
    case 'not_empty':     return str !== '' && displayVal != null;
    case 'row_even':      return (row + 1) % 2 === 0; // 1-based even rows: 2, 4, 6 …
    case 'row_odd':       return (row + 1) % 2 === 1; // 1-based odd rows:  1, 3, 5 …
    default:              return false;
  }
};

// Blend a hex color toward the dark base so CF colors remain readable in dark mode.
const darkAdaptColor = (hex) => {
  if (!hex) return hex;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum < 0.25) return hex; // already dark enough, keep as-is
  const base = 30; // #1e1e1e channel value
  const blend = (v) => Math.round(v * 0.28 + base * 0.72);
  const to2 = (n) => Math.min(255, n).toString(16).padStart(2, '0');
  return `#${to2(blend(r))}${to2(blend(g))}${to2(blend(b))}`;
};

const getCfStyle = (r, c, displayVal, rules) => {
  for (const rule of rules) {
    const { range, condition, style } = rule;
    if (range && (r < range.r1 || r > range.r2 || c < range.c1 || c > range.c2)) continue;
    if (evaluateCondition(displayVal, condition, r)) return style;
  }
  return null;
};

const applyNumFmt = (val, fmt) => {
  if (!fmt) return val;
  const n = Number(val);
  if (val === '' || isNaN(n)) return val;
  switch (fmt) {
    case 'int':   return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case 'fixed': return n.toFixed(2);
    case 'pct':   return n.toFixed(2) + '%';
    case 'usd':   return '$' + n.toFixed(2);
    default:      return val;
  }
};

const CELL_HEIGHT = 24; // must match CSS cell height

const evaluateRule = (value, rule) => {
  if (!rule) return true;
  switch (rule.type) {
    case 'list':
      return (rule.values ?? []).includes(String(value));
    case 'number': case 'text_length': {
      const n = rule.type === 'number' ? Number(value) : String(value).length;
      if (rule.type === 'number' && (value === '' || isNaN(n))) return false;
      const mn = Number(rule.min), mx = Number(rule.max);
      switch (rule.op) {
        case 'between': return n >= Math.min(mn, mx) && n <= Math.max(mn, mx);
        case 'gt':  return n > mn;
        case 'gte': return n >= mn;
        case 'lt':  return n < mn;
        case 'lte': return n <= mn;
        case 'eq':  return n === mn;
        case 'neq': return n !== mn;
        default: return true;
      }
    }
    default: return true; // custom formula: not evaluated client-side
  }
};

const fmtStat = (v) => {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + 'k';
  return parseFloat(v.toFixed(6)).toLocaleString();
};

const computeColStats = (data, colIdx) => {
  const allRows = data.length;
  const vals = data.map((r) => String(r[colIdx] ?? '')).filter((v) => v !== '');
  const nums = vals.map((v) => parseFloat(v.replace(/,/g, ''))).filter((v) => !isNaN(v));
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    total: allRows,
    count: vals.length,
    empty: allRows - vals.length,
    unique: new Set(vals).size,
    numeric: nums.length,
    sum: nums.length ? sum : null,
    avg: nums.length ? sum / nums.length : null,
    min: nums.length ? Math.min(...nums) : null,
    max: nums.length ? Math.max(...nums) : null,
  };
};

export default function Grid({ data, colWidths, selection, selections, dispatch, activeTabId, formulaCache, frozenRows = 0, frozenCols = 0, cellStyles, conditionalRules, hiddenRows, filterEnabled = false, activeFilters = {}, onFilterOpen, validationRules, onCellPick, onFormatToggle, findMatches, findCurrentIdx, darkMode = false }) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [cutRect, setCutRect] = useState(null);
  const [toast, setToast] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [colTooltip, setColTooltip] = useState(null); // { colIdx, x, y, stats }
  const editingCellRef = useRef(null);
  const wrapperRef = useRef(null);

  // Clear pending cut when the active tab changes (prevents cross-tab clear)
  useEffect(() => { setCutRect(null); }, [activeTabId]);

  // Scroll current find match into view
  useEffect(() => {
    const match = findMatches?.[findCurrentIdx];
    if (!match) return;
    const td = wrapperRef.current?.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
    td?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [findCurrentIdx, findMatches]);

  // Column auto-complete suggestions for the currently editing cell
  const colSuggestions = useMemo(() => {
    if (!editingCell || !data) return [];
    const { row: eRow, col: eCol } = editingCell;
    // Skip suggestions for all-numeric columns
    const allNumeric = data.every((row, r) => {
      if (r === eRow) return true;
      const v = String(row[eCol] ?? '');
      return v === '' || (!v.startsWith('=') && !isNaN(Number(v)));
    });
    if (allNumeric) return [];
    const seen = new Set();
    data.forEach((row, r) => {
      const v = String(row[eCol] ?? '');
      if (r !== eRow && v && !v.startsWith('=')) seen.add(v);
    });
    return [...seen].sort().slice(0, 50);
  }, [editingCell, data]);

  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    return (
      <div className={styles.empty}>
        <span>No data loaded</span>
        <span className={styles.emptyHint}>Import a file or drop one here</span>
      </div>
    );
  }

  const rows = data.length;
  const cols = data[0].length;

  const { anchor, active } = selection;
  const r1 = Math.min(anchor.row, active.row);
  const c1 = Math.min(anchor.col, active.col);
  const r2 = Math.max(anchor.row, active.row);
  const c2 = Math.max(anchor.col, active.col);

  // Build a set of all selected cell keys across every range (supports non-contiguous selection)
  const allSelections = selections ?? [selection];
  const selectedSet = new Set();
  for (const { anchor: a, active: act } of allSelections) {
    const sr1 = Math.min(a.row, act.row), sr2 = Math.max(a.row, act.row);
    const sc1 = Math.min(a.col, act.col), sc2 = Math.max(a.col, act.col);
    for (let r = sr1; r <= sr2; r++)
      for (let c = sc1; c <= sc2; c++) selectedSet.add(`${r},${c}`);
  }

  const findMatchSet = findMatches?.length
    ? new Set(findMatches.map((m) => `${m.row},${m.col}`))
    : null;

  const totalWidth =
    ROW_NUM_WIDTH +
    Array.from({ length: cols }, (_, c) => colWidths[c] ?? DEFAULT_COL_WIDTH).reduce(
      (sum, w) => sum + w,
      0
    );

  // Cumulative left offset for each data column (used for sticky frozen cols)
  const colLeftOffset = [];
  { let acc = ROW_NUM_WIDTH;
    for (let c = 0; c < cols; c++) { colLeftOffset.push(acc); acc += colWidths[c] ?? DEFAULT_COL_WIDTH; } }

  // ── Toast ────────────────────────────────────────────────────

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1500);
  };

  // ── Edit ─────────────────────────────────────────────────────

  const startEdit = (row, col, initialValue) => {
    editingCellRef.current = { row, col };
    setEditingCell({ row, col });
    setEditValue(initialValue ?? data[row][col]);
  };

  const commitEdit = (row, col, value, moveDelta) => {
    if (!editingCellRef.current) return;
    // Validate against rules before committing
    for (const vRule of (validationRules ?? [])) {
      const { range } = vRule;
      if (range && (row < range.r1 || row > range.r2 || col < range.c1 || col > range.c2)) continue;
      if (!evaluateRule(value, vRule.rule)) {
        const msg = vRule.errorMsg || `Invalid value${vRule.errorTitle ? `: ${vRule.errorTitle}` : ''}`;
        if (vRule.errorStyle === 'stop') { showToast(msg); cancelEdit(); return; }
        showToast(`⚠ ${msg}`);
        break;
      }
    }
    editingCellRef.current = null;
    setEditingCell(null);
    setEditValue('');
    dispatch({ type: 'SET_CELL', payload: { row, col, value } });
    if (moveDelta) {
      const nr = Math.max(0, Math.min(rows - 1, row + moveDelta.row));
      const nc = Math.max(0, Math.min(cols - 1, col + moveDelta.col));
      dispatch({
        type: 'SET_SELECTION',
        payload: { anchor: { row: nr, col: nc }, active: { row: nr, col: nc } },
      });
    }
    wrapperRef.current?.focus();
  };

  const cancelEdit = () => {
    editingCellRef.current = null;
    setEditingCell(null);
    setEditValue('');
    wrapperRef.current?.focus();
  };

  // ── Navigation ───────────────────────────────────────────────

  const moveTo = (row, col, extend = false) => {
    const nr = Math.max(0, Math.min(rows - 1, row));
    const nc = Math.max(0, Math.min(cols - 1, col));
    dispatch({
      type: 'SET_SELECTION',
      payload: extend
        ? { anchor, active: { row: nr, col: nc } }
        : { anchor: { row: nr, col: nc }, active: { row: nr, col: nc } },
    });
    const td = wrapperRef.current?.querySelector(`[data-row="${nr}"][data-col="${nc}"]`);
    td?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  // ── Clipboard ────────────────────────────────────────────────

  const getDisplayVal = (r, c) => {
    const key = `${colLabel(c)}${r + 1}`;
    return formulaCache && key in formulaCache ? formulaCache[key] : data[r][c];
  };

  const buildTsv = () => {
    const bbR1 = Math.min(...allSelections.map((s) => Math.min(s.anchor.row, s.active.row)));
    const bbR2 = Math.max(...allSelections.map((s) => Math.max(s.anchor.row, s.active.row)));
    const bbC1 = Math.min(...allSelections.map((s) => Math.min(s.anchor.col, s.active.col)));
    const bbC2 = Math.max(...allSelections.map((s) => Math.max(s.anchor.col, s.active.col)));
    const lines = [];
    for (let r = bbR1; r <= bbR2; r++) {
      const cells = [];
      for (let c = bbC1; c <= bbC2; c++) cells.push(getDisplayVal(r, c) ?? '');
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildTsv()).then(() => showToast('Copied'));
    setCutRect(null);
  };

  const handleCut = () => {
    navigator.clipboard.writeText(buildTsv()).then(() => showToast('Cut'));
    const bbR1 = Math.min(...allSelections.map((s) => Math.min(s.anchor.row, s.active.row)));
    const bbR2 = Math.max(...allSelections.map((s) => Math.max(s.anchor.row, s.active.row)));
    const bbC1 = Math.min(...allSelections.map((s) => Math.min(s.anchor.col, s.active.col)));
    const bbC2 = Math.max(...allSelections.map((s) => Math.max(s.anchor.col, s.active.col)));
    setCutRect({ r1: bbR1, c1: bbC1, r2: bbR2, c2: bbC2 });
  };

  const handlePaste = async () => {
    const savedCutRect = cutRect;
    try {
      const text = await navigator.clipboard.readText();
      const pasteRows = text
        .replace(/\r\n/g, '\n')
        .replace(/\n$/, '')
        .split('\n')
        .map((r) => r.split('\t'));
      if (!pasteRows.length || (pasteRows.length === 1 && pasteRows[0].length === 1 && pasteRows[0][0] === '')) return;
      dispatch({
        type: 'PASTE_RANGE',
        payload: { rows: pasteRows, destRow: active.row, destCol: active.col, clearRect: savedCutRect },
      });
      if (savedCutRect) setCutRect(null);
    } catch {
      showToast('Paste failed');
    }
  };

  // ── Header select ────────────────────────────────────────────

  const handleRowHeaderClick = (e, r) => {
    wrapperRef.current?.focus();
    dispatch({
      type: 'SET_SELECTION',
      payload: e.shiftKey
        ? { anchor, active: { row: r, col: cols - 1 } }
        : { anchor: { row: r, col: 0 }, active: { row: r, col: cols - 1 } },
    });
  };

  const handleColHeaderClick = (e, c) => {
    wrapperRef.current?.focus();
    dispatch({
      type: 'SET_SELECTION',
      payload: e.shiftKey
        ? { anchor, active: { row: rows - 1, col: c } }
        : { anchor: { row: 0, col: c }, active: { row: rows - 1, col: c } },
    });
  };

  // ── Context menus ────────────────────────────────────────────

  const handleRowContextMenu = (e, rowIdx) => {
    e.preventDefault();
    const inSel = rowIdx >= r1 && rowIdx <= r2;
    const delR1 = inSel ? r1 : rowIdx;
    const delR2 = inSel ? r2 : rowIdx;
    const delLabel = delR1 === delR2 ? 'Delete row' : `Delete ${delR2 - delR1 + 1} rows`;
    const freezeItems = [
      { separator: true },
      ...(frozenRows > 0
        ? [{ label: 'Unfreeze rows', action: () => dispatch({ type: 'SET_FROZEN', payload: { frozenRows: 0 } }) }]
        : []),
      { label: `Freeze rows 1 – ${rowIdx + 1}`, action: () => dispatch({ type: 'SET_FROZEN', payload: { frozenRows: rowIdx + 1 } }) },
    ];
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Insert row above', action: () => dispatch({ type: 'INSERT_ROW', payload: { index: rowIdx, position: 'above' } }) },
        { label: 'Insert row below', action: () => dispatch({ type: 'INSERT_ROW', payload: { index: rowIdx, position: 'below' } }) },
        { label: delLabel, action: () => dispatch({ type: 'DELETE_ROWS', payload: { r1: delR1, r2: delR2 } }) },
        ...freezeItems,
      ],
    });
  };

  const handleCellContextMenu = (e, r, c) => {
    e.preventDefault();
    if (!selectedSet.has(`${r},${c}`)) {
      dispatch({ type: 'SET_SELECTION', payload: { anchor: { row: r, col: c }, active: { row: r, col: c } } });
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Copy', action: handleCopy },
        { label: 'Cut', action: handleCut },
        { label: 'Paste', action: handlePaste },
      ],
    });
  };

  // ── Hover-select buttons ─────────────────────────────────────

  const handleRowSelectBtnClick = (e, r) => {
    e.stopPropagation();
    wrapperRef.current?.focus();
    const isRowSel = c1 === 0 && c2 === cols - 1;
    if (isRowSel) {
      dispatch({
        type: 'SET_SELECTION',
        payload: {
          anchor: { row: Math.min(r1, r), col: 0 },
          active: { row: Math.max(r2, r), col: cols - 1 },
        },
      });
    } else {
      dispatch({
        type: 'SET_SELECTION',
        payload: { anchor: { row: r, col: 0 }, active: { row: r, col: cols - 1 } },
      });
    }
  };

  const handleColSelectBtnClick = (e, c) => {
    e.stopPropagation();
    wrapperRef.current?.focus();
    const isColSel = r1 === 0 && r2 === rows - 1;
    if (isColSel) {
      dispatch({
        type: 'SET_SELECTION',
        payload: {
          anchor: { row: 0, col: Math.min(c1, c) },
          active: { row: rows - 1, col: Math.max(c2, c) },
        },
      });
    } else {
      dispatch({
        type: 'SET_SELECTION',
        payload: { anchor: { row: 0, col: c }, active: { row: rows - 1, col: c } },
      });
    }
  };

  const handleColContextMenu = (e, colIdx) => {
    e.preventDefault();
    const inSel = colIdx >= c1 && colIdx <= c2;
    const delC1 = inSel ? c1 : colIdx;
    const delC2 = inSel ? c2 : colIdx;
    const delLabel = delC1 === delC2 ? 'Delete column' : `Delete ${delC2 - delC1 + 1} columns`;
    const freezeColItems = [
      { separator: true },
      ...(frozenCols > 0
        ? [{ label: 'Unfreeze columns', action: () => dispatch({ type: 'SET_FROZEN', payload: { frozenCols: 0 } }) }]
        : []),
      { label: `Freeze columns A – ${colLabel(colIdx)}`, action: () => dispatch({ type: 'SET_FROZEN', payload: { frozenCols: colIdx + 1 } }) },
    ];
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Sort A → Z', action: () => dispatch({ type: 'SORT_BY_COL', payload: { colIdx, ascending: true } }) },
        { label: 'Sort Z → A', action: () => dispatch({ type: 'SORT_BY_COL', payload: { colIdx, ascending: false } }) },
        { separator: true },
        { label: 'Insert column left', action: () => dispatch({ type: 'INSERT_COL', payload: { index: colIdx, position: 'left' } }) },
        { label: 'Insert column right', action: () => dispatch({ type: 'INSERT_COL', payload: { index: colIdx, position: 'right' } }) },
        { label: delLabel, action: () => dispatch({ type: 'DELETE_COLS', payload: { c1: delC1, c2: delC2 } }) },
        ...freezeColItems,
      ],
    });
  };

  // ── Keyboard (wrapper) ───────────────────────────────────────

  const handleWrapperKeyDown = (e) => {
    if (editingCell !== null) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveTo(active.row - 1, active.col, e.shiftKey);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveTo(active.row + 1, active.col, e.shiftKey);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveTo(active.row, active.col - 1, e.shiftKey);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveTo(active.row, active.col + 1, e.shiftKey);
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          active.col > 0 ? moveTo(active.row, active.col - 1) : moveTo(active.row - 1, cols - 1);
        } else {
          active.col < cols - 1 ? moveTo(active.row, active.col + 1) : moveTo(active.row + 1, 0);
        }
        break;
      case 'Enter':
        e.preventDefault();
        moveTo(e.shiftKey ? active.row - 1 : active.row + 1, active.col);
        break;
      case 'Home':
        e.preventDefault();
        moveTo(e.ctrlKey ? 0 : active.row, 0, e.shiftKey);
        break;
      case 'End':
        e.preventDefault();
        moveTo(e.ctrlKey ? rows - 1 : active.row, cols - 1, e.shiftKey);
        break;
      case 'Escape':
        if (cutRect) setCutRect(null);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        dispatch({ type: 'CLEAR_RANGE', payload: { ranges: allSelections.map(({ anchor: a, active: act }) => ({
          r1: Math.min(a.row, act.row), c1: Math.min(a.col, act.col),
          r2: Math.max(a.row, act.row), c2: Math.max(a.col, act.col),
        })) } });
        break;
      default:
        if (e.ctrlKey || e.metaKey) {
          switch (e.key.toLowerCase()) {
            case 'z': e.preventDefault(); dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' }); break;
            case 'y': e.preventDefault(); dispatch({ type: 'REDO' }); break;
            case 'c': e.preventDefault(); handleCopy(); break;
            case 'x': e.preventDefault(); handleCut(); break;
            case 'v': e.preventDefault(); handlePaste(); break;
            case 'b': e.preventDefault(); onFormatToggle?.('bold'); break;
            case 'i': e.preventDefault(); onFormatToggle?.('italic'); break;
            case 'u': e.preventDefault(); onFormatToggle?.('underline'); break;
            case 'a':
              e.preventDefault();
              dispatch({ type: 'SET_SELECTION', payload: { anchor: { row: 0, col: 0 }, active: { row: rows - 1, col: cols - 1 } } });
              break;
          }
        } else if (e.key.length === 1 && !e.altKey) {
          startEdit(active.row, active.col, e.key);
        }
    }
  };

  // ── Keyboard (cell input) ────────────────────────────────────

  const handleInputKeyDown = (e, row, col) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        commitEdit(row, col, editValue, { row: e.shiftKey ? -1 : 1, col: 0 });
        break;
      case 'Tab':
        e.preventDefault();
        commitEdit(row, col, editValue, { row: 0, col: e.shiftKey ? -1 : 1 });
        break;
      case 'Escape':
        e.preventDefault();
        cancelEdit();
        break;
    }
  };

  // ── Mouse ────────────────────────────────────────────────────

  const handleCellClick = (e, row, col) => {
    if (onCellPick) {
      onCellPick(row, col);
      return;
    }
    wrapperRef.current?.focus();
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.shiftKey) {
      // Extend active of last range
      const newSels = [...allSelections];
      const last = newSels.length - 1;
      newSels[last] = { ...newSels[last], active: { row, col } };
      dispatch({ type: 'SET_SELECTIONS', payload: { selections: newSels, activeSelIdx: last } });
    } else if (ctrl) {
      // Add a new independent range
      const newSels = [...allSelections, { anchor: { row, col }, active: { row, col } }];
      dispatch({ type: 'SET_SELECTIONS', payload: { selections: newSels, activeSelIdx: newSels.length - 1 } });
    } else if (e.shiftKey) {
      dispatch({ type: 'SET_SELECTION', payload: { anchor, active: { row, col } } });
    } else {
      dispatch({ type: 'SET_SELECTION', payload: { anchor: { row, col }, active: { row, col } } });
    }
  };

  const handleCellDoubleClick = (row, col) => {
    startEdit(row, col, data[row][col]);
  };

  // ── Column resize ─────────────────────────────────────────────

  const startResize = (e, colIdx) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[colIdx] ?? DEFAULT_COL_WIDTH;
    const onMove = (ev) =>
      dispatch({
        type: 'SET_COL_WIDTH',
        payload: { tabId: activeTabId, colIdx, width: Math.max(40, startW + ev.clientX - startX) },
      });
    const onUp = () => document.removeEventListener('mousemove', onMove);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      ref={wrapperRef}
      className={styles.gridWrapper}
      tabIndex={0}
      onKeyDown={handleWrapperKeyDown}
      style={{ outline: 'none' }}
    >
      <table className={styles.table} style={{ width: totalWidth }}>
        <colgroup>
          <col style={{ width: ROW_NUM_WIDTH }} />
          {Array.from({ length: cols }, (_, c) => (
            <col key={c} style={{ width: colWidths[c] ?? DEFAULT_COL_WIDTH }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className={styles.corner} style={{ width: ROW_NUM_WIDTH }} />
            {Array.from({ length: cols }, (_, c) => (
              <th
                key={c}
                className={styles.colHeader}
                onClick={(e) => handleColHeaderClick(e, c)}
                onContextMenu={(e) => handleColContextMenu(e, c)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setColTooltip({ colIdx: c, x: rect.left, y: rect.bottom + 4, stats: computeColStats(data, c) });
                }}
                onMouseLeave={() => setColTooltip(null)}
                style={{
                  ...(frozenCols > 0 && c < frozenCols ? { position: 'sticky', left: colLeftOffset[c], zIndex: 3, background: darkMode ? '#2d2d2d' : '#f2f2f2' } : {}),
                  ...(frozenCols > 0 && c === frozenCols - 1 ? { boxShadow: 'inset -2px 0 0 #7aabcf' } : {}),
                }}
              >
                {colLabel(c)}
                {filterEnabled && (
                  <button
                    className={[styles.filterBtn, activeFilters[c] ? styles.filterBtnActive : ''].filter(Boolean).join(' ')}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onFilterOpen?.(c, rect.left, rect.bottom + 2);
                    }}
                    title="Filter this column"
                  >
                    ▼
                  </button>
                )}
                <button
                  className={styles.colSelectBtn}
                  onClick={(e) => handleColSelectBtnClick(e, c)}
                  title="Extend selection to this column"
                >
                  +
                </button>
                <div
                  className={styles.resizeHandle}
                  onMouseDown={(e) => startResize(e, c)}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => {
            if (hiddenRows?.has(r)) return null;
            return (<tr key={r}>
              <td
                className={styles.rowNum}
                onClick={(e) => handleRowHeaderClick(e, r)}
                onContextMenu={(e) => handleRowContextMenu(e, r)}
                style={{
                  ...(frozenRows > 0 && r < frozenRows ? { top: CELL_HEIGHT * (r + 1), zIndex: 2, background: darkMode ? '#2d2d2d' : '#f2f2f2' } : {}),
                  ...(frozenRows > 0 && r === frozenRows - 1 ? { boxShadow: 'inset 0 -2px 0 #7aabcf' } : {}),
                }}
              >
                {r + 1}
                <button
                  className={styles.rowSelectBtn}
                  onClick={(e) => handleRowSelectBtnClick(e, r)}
                  title="Extend selection to this row"
                >
                  +
                </button>
              </td>
              {Array.from({ length: cols }, (_, c) => {
                const selected = selectedSet.has(`${r},${c}`);
                const isActive = r === active.row && c === active.col;
                const isEditing = editingCell?.row === r && editingCell?.col === c;
                const isCut = cutRect && r >= cutRect.r1 && r <= cutRect.r2 && c >= cutRect.c1 && c <= cutRect.c2;
                const isMatch = findMatchSet?.has(`${r},${c}`) ?? false;
                const currentMatch = findMatches?.[findCurrentIdx];
                const isCurrent = isMatch && currentMatch?.row === r && currentMatch?.col === c;
                const cls = [
                  styles.cell,
                  selected ? styles.selected : '',
                  isActive && !isEditing ? styles.active : '',
                  isCut ? styles.cutCell : '',
                  isCurrent ? styles.findMatchCurrent : isMatch ? styles.findMatch : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const cellKey = `${colLabel(c)}${r + 1}`;
                const rawDisplayVal = formulaCache && cellKey in formulaCache
                  ? formulaCache[cellKey]
                  : data[r][c];
                const isError = isFormulaError(rawDisplayVal);
                const st = cellStyles?.[`${r},${c}`] ?? {};
                const displayVal = (!isError && st.numFmt) ? applyNumFmt(rawDisplayVal, st.numFmt) : rawDisplayVal;
                const cfSt = getCfStyle(r, c, rawDisplayVal, conditionalRules ?? []);
                // CF styles are base; manual cellStyles override for each property
                const finalBg = st.bg || (!isMatch ? (cfSt?.bg ?? '') : '');
                const finalColor = st.color || cfSt?.color || '';
                const finalBold = st.bold || cfSt?.bold || false;
                const finalItalic = st.italic || cfSt?.italic || false;
                const tdStyle = {};
                if (finalBg) tdStyle.background = darkMode ? darkAdaptColor(finalBg) : finalBg;
                if (st.align) tdStyle.textAlign = st.align;
                const rowFrozen = frozenRows > 0 && r < frozenRows;
                const colFrozen = frozenCols > 0 && c < frozenCols;
                if (rowFrozen || colFrozen) {
                  tdStyle.position = 'sticky';
                  if (!tdStyle.background) tdStyle.background = darkMode ? '#252526' : '#fff';
                  if (rowFrozen) tdStyle.top = CELL_HEIGHT * (r + 1);
                  if (colFrozen) tdStyle.left = colLeftOffset[c];
                  tdStyle.zIndex = (rowFrozen && colFrozen) ? 2 : 1;
                }
                let freezeShadow = '';
                if (frozenRows > 0 && r === frozenRows - 1) freezeShadow = 'inset 0 -2px 0 #7aabcf';
                if (frozenCols > 0 && c === frozenCols - 1)
                  freezeShadow = freezeShadow ? `${freezeShadow}, inset -2px 0 0 #7aabcf` : 'inset -2px 0 0 #7aabcf';
                if (freezeShadow) tdStyle.boxShadow = freezeShadow;
                const spanStyle = {};
                if (finalBold) spanStyle.fontWeight = 'bold';
                if (finalItalic) spanStyle.fontStyle = 'italic';
                if (st.underline) spanStyle.textDecoration = 'underline';
                if (finalColor) spanStyle.color = finalColor;
                return (
                  <td
                    key={c}
                    className={cls}
                    data-row={r}
                    data-col={c}
                    style={tdStyle}
                    onMouseDown={(e) => { if (onCellPick) e.preventDefault(); }}
                    onClick={(e) => handleCellClick(e, r, c)}
                    onDoubleClick={() => handleCellDoubleClick(r, c)}
                    onContextMenu={(e) => handleCellContextMenu(e, r, c)}
                  >
                    {isEditing ? (() => {
                      const listRule = (validationRules ?? []).find((vr) => {
                        const { range } = vr;
                        if (range && (r < range.r1 || r > range.r2 || c < range.c1 || c > range.c2)) return false;
                        return vr.rule?.type === 'list';
                      });
                      return listRule ? (
                        <select
                          className={styles.cellInput}
                          autoFocus
                          value={editValue}
                          onChange={(e) => commitEdit(r, c, e.target.value, null)}
                          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); } }}
                          onBlur={() => cancelEdit()}
                        >
                          {(listRule.rule.values ?? []).map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            className={styles.cellInput}
                            list={colSuggestions.length ? `col-suggest-${c}` : undefined}
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleInputKeyDown(e, r, c)}
                            onBlur={() => commitEdit(r, c, editValue, null)}
                          />
                          {colSuggestions.length > 0 && (
                            <datalist id={`col-suggest-${c}`}>
                              {colSuggestions.map((v) => <option key={v} value={v} />)}
                            </datalist>
                          )}
                        </>
                      );
                    })() : (
                      <span
                        className={[styles.cellContent, isError ? styles.formulaError : ''].filter(Boolean).join(' ')}
                        style={spanStyle}
                        title={isError ? formulaErrorTitle(rawDisplayVal) : undefined}
                      >
                        {displayVal}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ); })}
        </tbody>
      </table>

      {toast && <div className={styles.toast}>{toast}</div>}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
      {colTooltip && (
        <div
          className={styles.colStatsTooltip}
          style={{ left: colTooltip.x, top: colTooltip.y }}
          onMouseEnter={() => setColTooltip(null)}
        >
          {[
            ['Count', colTooltip.stats.count],
            ['Empty', colTooltip.stats.empty],
            ['Unique', colTooltip.stats.unique],
            ...(colTooltip.stats.numeric > 0 ? [
              ['Numeric', colTooltip.stats.numeric],
              ['Sum', fmtStat(colTooltip.stats.sum)],
              ['Avg', fmtStat(colTooltip.stats.avg)],
              ['Min', fmtStat(colTooltip.stats.min)],
              ['Max', fmtStat(colTooltip.stats.max)],
            ] : []),
          ].map(([label, val]) => (
            <div key={label} className={styles.colStatRow}>
              <span className={styles.colStatLabel}>{label}</span>
              <span className={styles.colStatVal}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
