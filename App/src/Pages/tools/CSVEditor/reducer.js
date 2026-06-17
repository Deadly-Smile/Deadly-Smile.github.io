import { createTab, shiftFormulaRows, shiftFormulaCols } from './utils.js';

const applyRowShift = (data, atRow1, delta) =>
  data.map((row) =>
    row.map((cell) =>
      typeof cell === 'string' && cell.startsWith('=')
        ? shiftFormulaRows(cell, atRow1, delta)
        : cell
    )
  );

const applyColShift = (data, atCol, delta) =>
  data.map((row) =>
    row.map((cell) =>
      typeof cell === 'string' && cell.startsWith('=')
        ? shiftFormulaCols(cell, atCol, delta)
        : cell
    )
  );

export const makeInitialState = () => {
  const tab = createTab();
  return { tabs: [tab], activeTabId: tab.id };
};

const MAX_HISTORY = 50;

const pushHistory = (tab) => ({
  past: [...tab.past.slice(-(MAX_HISTORY - 1)), tab.data],
  future: [],
});

const updateActiveTab = (state, updater) => ({
  ...state,
  tabs: state.tabs.map((t) => (t.id === state.activeTabId ? updater(t) : t)),
});

export const reducer = (state, action) => {
  switch (action.type) {
    case 'IMPORT_CSV': {
      const { data, name } = action.payload;
      const newTab = createTab(name, data);
      newTab.colWidths = data[0]?.map(() => 100) ?? [];
      return { ...state, tabs: [...state.tabs, newTab], activeTabId: newTab.id };
    }

    case 'IMPORT_WORKBOOK': {
      const { sheets } = action.payload; // [{ data, name }]
      const newTabs = sheets.map(({ data, name }) => {
        const tab = createTab(name, data);
        tab.colWidths = data[0]?.map(() => 100) ?? [];
        return tab;
      });
      return { ...state, tabs: [...state.tabs, ...newTabs], activeTabId: newTabs[0].id };
    }

    case 'SET_CELL': {
      const { row, col, value } = action.payload;
      return updateActiveTab(state, (tab) => {
        const { past, future } = pushHistory(tab);
        const newData = tab.data.map((r, ri) =>
          ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
        );
        return { ...tab, data: newData, past, future };
      });
    }

    case 'SET_SELECTION': {
      return updateActiveTab(state, (tab) => ({ ...tab, selections: [action.payload], activeSelIdx: 0 }));
    }

    case 'SET_SELECTIONS': {
      const { selections, activeSelIdx = 0 } = action.payload;
      return updateActiveTab(state, (tab) => ({ ...tab, selections, activeSelIdx }));
    }

    case 'SET_COL_WIDTH': {
      const { tabId, colIdx, width } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, colWidths: t.colWidths.map((w, i) => (i === colIdx ? width : w)) }
            : t
        ),
      };
    }

    case 'CLEAR_RANGE': {
      const ranges = action.payload.ranges ?? [action.payload];
      return updateActiveTab(state, (tab) => {
        const { past, future } = pushHistory(tab);
        const newData = tab.data.map((row, r) =>
          row.map((cell, c) => {
            for (const { r1, c1, r2, c2 } of ranges)
              if (r >= r1 && r <= r2 && c >= c1 && c <= c2) return '';
            return cell;
          })
        );
        return { ...tab, data: newData, past, future };
      });
    }

    case 'UNDO': {
      return updateActiveTab(state, (tab) => {
        if (tab.past.length === 0) return tab;
        const restoredData = tab.past[tab.past.length - 1];
        return {
          ...tab,
          data: restoredData,
          past: tab.past.slice(0, -1),
          future: [tab.data, ...tab.future],
        };
      });
    }

    case 'REDO': {
      return updateActiveTab(state, (tab) => {
        if (tab.future.length === 0) return tab;
        const [restoredData, ...newFuture] = tab.future;
        return {
          ...tab,
          data: restoredData,
          past: [...tab.past, tab.data],
          future: newFuture,
        };
      });
    }

    case 'ADD_TAB': {
      const newTab = createTab(`Sheet ${state.tabs.length + 1}`);
      return { ...state, tabs: [...state.tabs, newTab], activeTabId: newTab.id };
    }

    case 'REMOVE_TAB': {
      const { tabId } = action.payload;
      if (state.tabs.length === 1) {
        const fresh = createTab();
        return { ...state, tabs: [fresh], activeTabId: fresh.id };
      }
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const newActiveId =
        tabId === state.activeTabId
          ? (newTabs[Math.max(0, idx - 1)]?.id ?? newTabs[0].id)
          : state.activeTabId;
      return { ...state, tabs: newTabs, activeTabId: newActiveId };
    }

    case 'RENAME_TAB': {
      const { tabId, name } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)),
      };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTabId: action.payload.tabId };

    case 'REORDER_TABS': {
      const { fromIdx, toIdx } = action.payload;
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(fromIdx, 1);
      newTabs.splice(toIdx, 0, moved);
      return { ...state, tabs: newTabs };
    }

    case 'PASTE_RANGE': {
      const { rows, destRow, destCol, clearRect } = action.payload;
      if (!rows.length) return state;
      return updateActiveTab(state, (tab) => {
        const { past, future } = pushHistory(tab);
        let newData = tab.data.map((r) => [...r]);
        let newColWidths = [...tab.colWidths];

        // Expand rows if needed
        const curCols = newData[0]?.length ?? 1;
        while (newData.length < destRow + rows.length) {
          newData.push(Array(curCols).fill(''));
        }
        // Expand cols if needed
        const maxPasteCol = destCol + Math.max(...rows.map((r) => r.length));
        if (maxPasteCol > newData[0].length) {
          const extra = maxPasteCol - newData[0].length;
          newData = newData.map((r) => [...r, ...Array(extra).fill('')]);
          newColWidths = [...newColWidths, ...Array(extra).fill(100)];
        }
        // Clear cut source first (pasted value wins over clear on overlap)
        if (clearRect) {
          const { r1, c1, r2, c2 } = clearRect;
          newData = newData.map((row, r) =>
            r >= r1 && r <= r2 ? row.map((cell, c) => (c >= c1 && c <= c2 ? '' : cell)) : row
          );
        }
        // Write paste data
        for (let dr = 0; dr < rows.length; dr++) {
          for (let dc = 0; dc < rows[dr].length; dc++) {
            newData[destRow + dr][destCol + dc] = rows[dr][dc];
          }
        }
        return { ...tab, data: newData, colWidths: newColWidths, past, future };
      });
    }

    case 'INSERT_ROW': {
      const { index, position } = action.payload;
      return updateActiveTab(state, (tab) => {
        const { past, future } = pushHistory(tab);
        const at = position === 'above' ? index : index + 1;
        const atRow1 = at + 1;
        const newRow = Array(tab.data[0]?.length ?? 1).fill('');
        const inserted = [...tab.data.slice(0, at), newRow, ...tab.data.slice(at)];
        const newData = applyRowShift(inserted, atRow1, 1);
        const shift = (r) => (r >= at ? r + 1 : r);
        const sel = tab.selections?.[tab.activeSelIdx ?? 0] ?? { anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } };
        const newSel = {
          anchor: { ...sel.anchor, row: shift(sel.anchor.row) },
          active: { ...sel.active, row: shift(sel.active.row) },
        };
        return { ...tab, data: newData, selections: [newSel], activeSelIdx: 0, past, future };
      });
    }

    case 'DELETE_ROWS': {
      const { r1, r2 } = action.payload;
      return updateActiveTab(state, (tab) => {
        if (tab.data.length <= 1) return tab;
        const { past, future } = pushHistory(tab);
        const filtered = tab.data.filter((_, r) => r < r1 || r > r2);
        const result = filtered.length ? filtered : [Array(tab.data[0]?.length ?? 1).fill('')];
        const newData = applyRowShift(result, r2 + 2, -(r2 - r1 + 1));
        const maxRow = newData.length - 1;
        const clamp = (r) => {
          if (r >= r1 && r <= r2) return Math.min(r1, maxRow);
          if (r > r2) return r - (r2 - r1 + 1);
          return r;
        };
        const sel = tab.selections?.[tab.activeSelIdx ?? 0] ?? { anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } };
        const newSel = {
          anchor: { ...sel.anchor, row: Math.max(0, Math.min(maxRow, clamp(sel.anchor.row))) },
          active: { ...sel.active, row: Math.max(0, Math.min(maxRow, clamp(sel.active.row))) },
        };
        return { ...tab, data: newData, selections: [newSel], activeSelIdx: 0, past, future };
      });
    }

    case 'INSERT_COL': {
      const { index, position } = action.payload;
      return updateActiveTab(state, (tab) => {
        const { past, future } = pushHistory(tab);
        const at = position === 'left' ? index : index + 1;
        const inserted = tab.data.map((row) => [...row.slice(0, at), '', ...row.slice(at)]);
        const newData = applyColShift(inserted, at, 1);
        const newColWidths = [...tab.colWidths.slice(0, at), 100, ...tab.colWidths.slice(at)];
        const shift = (c) => (c >= at ? c + 1 : c);
        const sel = tab.selections?.[tab.activeSelIdx ?? 0] ?? { anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } };
        const newSel = {
          anchor: { ...sel.anchor, col: shift(sel.anchor.col) },
          active: { ...sel.active, col: shift(sel.active.col) },
        };
        return { ...tab, data: newData, colWidths: newColWidths, selections: [newSel], activeSelIdx: 0, past, future };
      });
    }

    case 'DELETE_COLS': {
      const { c1, c2 } = action.payload;
      return updateActiveTab(state, (tab) => {
        if ((tab.data[0]?.length ?? 0) <= 1) return tab;
        const { past, future } = pushHistory(tab);
        const filtered = tab.data.map((row) => row.filter((_, c) => c < c1 || c > c2));
        const result = filtered.map((r) => (r.length ? r : ['']));
        const newData = applyColShift(result, c2 + 1, -(c2 - c1 + 1));
        const newColWidths = tab.colWidths.filter((_, c) => c < c1 || c > c2);
        const finalWidths = newColWidths.length ? newColWidths : [100];
        const maxCol = (newData[0]?.length ?? 1) - 1;
        const clamp = (c) => {
          if (c >= c1 && c <= c2) return Math.min(c1, maxCol);
          if (c > c2) return c - (c2 - c1 + 1);
          return c;
        };
        const sel = tab.selections?.[tab.activeSelIdx ?? 0] ?? { anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } };
        const newSel = {
          anchor: { ...sel.anchor, col: Math.max(0, Math.min(maxCol, clamp(sel.anchor.col))) },
          active: { ...sel.active, col: Math.max(0, Math.min(maxCol, clamp(sel.active.col))) },
        };
        return { ...tab, data: newData, colWidths: finalWidths, selections: [newSel], activeSelIdx: 0, past, future };
      });
    }

    case 'SET_CELL_STYLE': {
      const { r1, c1, r2, c2, style } = action.payload;
      return updateActiveTab(state, (tab) => {
        const newStyles = { ...tab.cellStyles };
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const key = `${r},${c}`;
            const merged = { ...(newStyles[key] ?? {}), ...style };
            Object.keys(merged).forEach((k) => { if (!merged[k]) delete merged[k]; });
            if (Object.keys(merged).length) newStyles[key] = merged;
            else delete newStyles[key];
          }
        }
        return { ...tab, cellStyles: newStyles };
      });
    }

    case 'SET_FROZEN': {
      const { frozenRows, frozenCols } = action.payload;
      return updateActiveTab(state, (tab) => ({
        ...tab,
        frozenRows: frozenRows !== undefined
          ? Math.max(0, Math.min(frozenRows, tab.data.length - 1))
          : tab.frozenRows,
        frozenCols: frozenCols !== undefined
          ? Math.max(0, Math.min(frozenCols, (tab.data[0]?.length ?? 1) - 1))
          : tab.frozenCols,
      }));
    }

    case 'ADD_COND_RULE':
      return updateActiveTab(state, (tab) => ({
        ...tab,
        conditionalRules: [...(tab.conditionalRules ?? []), action.payload],
      }));

    case 'UPDATE_COND_RULE':
      return updateActiveTab(state, (tab) => ({
        ...tab,
        conditionalRules: (tab.conditionalRules ?? []).map((r) =>
          r.id === action.payload.id ? action.payload : r
        ),
      }));

    case 'REMOVE_COND_RULE':
      return updateActiveTab(state, (tab) => ({
        ...tab,
        conditionalRules: (tab.conditionalRules ?? []).filter((r) => r.id !== action.payload),
      }));

    case 'SET_DIALECT':
      return updateActiveTab(state, (tab) => ({
        ...tab,
        dialect: { ...(tab.dialect ?? { delimiter: 'auto', quoteChar: '"' }), ...action.payload },
      }));

    case 'ADD_VALIDATION_RULE':
      return updateActiveTab(state, (tab) => ({
        ...tab, validationRules: [...(tab.validationRules ?? []), action.payload],
      }));

    case 'UPDATE_VALIDATION_RULE':
      return updateActiveTab(state, (tab) => ({
        ...tab, validationRules: (tab.validationRules ?? []).map((r) => r.id === action.payload.id ? action.payload : r),
      }));

    case 'REMOVE_VALIDATION_RULE':
      return updateActiveTab(state, (tab) => ({
        ...tab, validationRules: (tab.validationRules ?? []).filter((r) => r.id !== action.payload),
      }));

    case 'ADD_NAMED_RANGE':
      return updateActiveTab(state, (tab) => ({
        ...tab, namedRanges: [...(tab.namedRanges ?? []), action.payload],
      }));

    case 'UPDATE_NAMED_RANGE':
      return updateActiveTab(state, (tab) => ({
        ...tab, namedRanges: (tab.namedRanges ?? []).map((r) => r.id === action.payload.id ? action.payload : r),
      }));

    case 'REMOVE_NAMED_RANGE':
      return updateActiveTab(state, (tab) => ({
        ...tab, namedRanges: (tab.namedRanges ?? []).filter((r) => r.id !== action.payload),
      }));

    case 'SET_FILTER_ENABLED': {
      const { enabled } = action.payload;
      return updateActiveTab(state, (tab) => ({
        ...tab,
        filterEnabled: enabled,
        activeFilters: enabled ? (tab.activeFilters ?? {}) : {},
      }));
    }

    case 'SET_COL_FILTER': {
      const { colIdx, allowedValues } = action.payload;
      return updateActiveTab(state, (tab) => {
        const newFilters = { ...(tab.activeFilters ?? {}) };
        if (allowedValues === null) delete newFilters[colIdx];
        else newFilters[colIdx] = allowedValues;
        return { ...tab, activeFilters: newFilters };
      });
    }

    case 'CLEAR_ALL_FILTERS':
      return updateActiveTab(state, (tab) => ({ ...tab, activeFilters: {} }));

    case 'SORT_BY_COL': {
      const { colIdx, ascending } = action.payload;
      return updateActiveTab(state, (tab) => {
        const { past, future } = pushHistory(tab);
        const newData = [...tab.data].sort((a, b) => {
          const va = a[colIdx] ?? '', vb = b[colIdx] ?? '';
          const na = Number(va), nb = Number(vb);
          const numSort = va !== '' && vb !== '' && !isNaN(na) && !isNaN(nb);
          const cmp = numSort ? na - nb : String(va).localeCompare(String(vb));
          return ascending ? cmp : -cmp;
        });
        return { ...tab, data: newData, activeFilters: {}, past, future };
      });
    }

    case 'REPLACE_ALL': {
      const { replacements } = action.payload; // [{ row, col, value }]
      if (!replacements.length) return state;
      return updateActiveTab(state, (tab) => {
        const { past, future } = pushHistory(tab);
        const newData = tab.data.map((row) => [...row]);
        for (const { row, col, value } of replacements) {
          newData[row][col] = value;
        }
        return { ...tab, data: newData, past, future };
      });
    }

    default:
      return state;
  }
};
