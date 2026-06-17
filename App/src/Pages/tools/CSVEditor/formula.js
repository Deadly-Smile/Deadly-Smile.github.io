import { Parser } from 'hot-formula-parser';
import { colLabel, colIndex } from './utils.js';

export const ERROR_VALUES = new Set([
  '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#ERROR!', '#NULL!', '#CIRC',
]);

const ERROR_MAP = {
  DIV_0: '#DIV/0!',
  VALUE: '#VALUE!',
  REF: '#REF!',
  NAME: '#NAME?',
  NUM: '#NUM!',
  NA: '#N/A',
  ERROR: '#ERROR!',
  NULL: '#NULL!',
};

// Extract all cell keys that a formula string depends on
function extractRefs(formula) {
  const refs = new Set();
  const rangeRe = /\b([A-Z]+)(\d+):([A-Z]+)(\d+)\b/g;
  let m;
  while ((m = rangeRe.exec(formula)) !== null) {
    const r1 = parseInt(m[2], 10) - 1, c1 = colIndex(m[1]);
    const r2 = parseInt(m[4], 10) - 1, c2 = colIndex(m[3]);
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
        refs.add(`${colLabel(c)}${r + 1}`);
  }
  const cellRe = /\b([A-Z]+)(\d+)\b/g;
  while ((m = cellRe.exec(formula)) !== null) refs.add(`${m[1]}${m[2]}`);
  return refs;
}

function substituteNamedRanges(formula, namedRanges) {
  if (!namedRanges?.length) return formula;
  const sorted = [...namedRanges].sort((a, b) => b.name.length - a.name.length);
  let result = formula;
  for (const { name, range } of sorted) {
    if (!name || !range) continue;
    const { r1, c1, r2, c2 } = range;
    const rangeStr = `${colLabel(c1)}${r1 + 1}:${colLabel(c2)}${r2 + 1}`;
    result = result.replace(new RegExp(`\\b${name}\\b`, 'g'), rangeStr);
  }
  return result;
}

export function buildFormulaCache(data, namedRanges = []) {
  if (!data || data.length === 0) return {};

  const rows = data.length;
  const cols = data[0]?.length ?? 0;

  // Collect formula cells
  const formulaCells = new Map(); // cellKey → formula (without leading =)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const raw = data[r][c];
      if (typeof raw === 'string' && raw.startsWith('=')) {
        formulaCells.set(`${colLabel(c)}${r + 1}`, substituteNamedRanges(raw.slice(1), namedRanges));
      }
    }
  }

  if (formulaCells.size === 0) return {};

  // Build dependency graph (only formula→formula edges matter for ordering)
  const inDegree = new Map();
  const dependents = new Map(); // key → Set<keys that depend on key>

  for (const [key, formula] of formulaCells) {
    const formulaDeps = new Set();
    for (const ref of extractRefs(formula)) {
      if (formulaCells.has(ref)) {
        formulaDeps.add(ref);
        if (!dependents.has(ref)) dependents.set(ref, new Set());
        dependents.get(ref).add(key);
      }
    }
    inDegree.set(key, formulaDeps.size);
  }

  // Kahn's topological sort
  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([k]) => k);
  const evalOrder = [];
  while (queue.length) {
    const key = queue.shift();
    evalOrder.push(key);
    for (const dep of (dependents.get(key) ?? [])) {
      const newDeg = inDegree.get(dep) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  const cache = {};

  // Mark cycle cells
  for (const key of formulaCells.keys()) {
    if (!evalOrder.includes(key)) cache[key] = '#CIRC';
  }

  const parser = new Parser();

  const resolveCell = (r, c) => {
    const key = `${colLabel(c)}${r + 1}`;
    if (key in cache) return cache[key];
    const raw = data[r]?.[c] ?? '';
    const num = Number(raw);
    return raw === '' || isNaN(num) ? raw : num;
  };

  parser.on('callCellValue', ({ row, column }, done) => {
    done(resolveCell(row.index, column.index));
  });

  parser.on('callRangeValue', (startCell, endCell, done) => {
    const matrix = [];
    for (let r = startCell.row.index; r <= endCell.row.index; r++) {
      const rowArr = [];
      for (let c = startCell.column.index; c <= endCell.column.index; c++) {
        rowArr.push(resolveCell(r, c));
      }
      matrix.push(rowArr);
    }
    done(matrix);
  });

  for (const key of evalOrder) {
    const { result, error } = parser.parse(formulaCells.get(key));
    cache[key] = error ? (ERROR_MAP[error] ?? `#${error}`) : result;
  }

  return cache;
}

export const isFormulaError = (val) => ERROR_VALUES.has(String(val));

const ERROR_DESCRIPTIONS = {
  '#DIV/0!': 'Division by zero',
  '#VALUE!': 'Wrong value type in formula',
  '#REF!': 'Invalid cell reference',
  '#NAME?': 'Unknown function or named range',
  '#NUM!': 'Invalid numeric value',
  '#N/A': 'Value not available',
  '#ERROR!': 'Formula parse error',
  '#NULL!': 'Invalid range intersection',
  '#CIRC': 'Circular reference detected',
};

export const formulaErrorTitle = (val) => ERROR_DESCRIPTIONS[String(val)] ?? 'Formula error';
