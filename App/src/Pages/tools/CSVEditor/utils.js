export const colLabel = (i) => {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(((i - 1) % 26) + 65) + s;
  return s;
};

export const colIndex = (label) => {
  let n = 0;
  for (const ch of label) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// Shift row references in a raw formula string (including leading '=').
// atRow1: 1-indexed; references with row >= atRow1 are shifted by delta.
export const shiftFormulaRows = (formula, atRow1, delta) =>
  formula.replace(/\b([A-Z]+)(\d+)\b/g, (match, col, rowStr) => {
    const row = parseInt(rowStr, 10);
    return row >= atRow1 ? col + (row + delta) : match;
  });

// Shift column references in a raw formula string.
// atCol: 0-indexed; references with col_index >= atCol are shifted by delta.
export const shiftFormulaCols = (formula, atCol, delta) =>
  formula.replace(/\b([A-Z]+)(\d+)\b/g, (match, colStr, rowStr) => {
    const c = colIndex(colStr);
    return c >= atCol ? colLabel(c + delta) + rowStr : match;
  });

export const padRows = (data) => {
  const maxLen = Math.max(...data.map((r) => r.length), 0);
  if (maxLen === 0) return [['']];
  return data.map((row) =>
    row.length < maxLen ? [...row, ...Array(maxLen - row.length).fill('')] : row
  );
};

export const createTab = (name = 'Sheet 1', data = [['']]) => ({
  id: crypto.randomUUID(),
  name,
  data,
  colWidths: data[0]?.map(() => 100) ?? [100],
  formulaCache: {},
  frozenRows: 0,
  frozenCols: 0,
  dialect: { delimiter: 'auto', quoteChar: '"' },
  namedRanges: [],          // [{ id, name, range: { r1, c1, r2, c2 } }]
  validationRules: [],     // [{ id, range, rule, errorStyle, errorTitle, errorMsg }]
  filterEnabled: false,
  activeFilters: {},       // { [colIdx]: string[] } — values to SHOW; absent = show all
  cellStyles: {},          // { "r,c": { bold, italic, underline, align, color, bg, numFmt } }
  conditionalRules: [
    {
      id: crypto.randomUUID(),
      range: null,
      condition: { type: 'row_even' },
      style: { bg: '#e8f4fd' },
    },
  ],
  selections: [{ anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } }],
  activeSelIdx: 0,
  past: [],
  future: [],
});
