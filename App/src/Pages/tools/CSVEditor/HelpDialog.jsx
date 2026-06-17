import { useState } from 'react';
import styles from './CSVEditor.module.css';

const NAV = [
  { id: 'overview',    label: 'Overview'               },
  { id: 'navigation',  label: 'Navigation & Selection'  },
  { id: 'editing',     label: 'Editing Cells'           },
  { id: 'clipboard',   label: 'Copy, Cut & Paste'       },
  { id: 'rowcol',      label: 'Rows & Columns'          },
  { id: 'formulas',    label: 'Formulas'                },
  { id: 'formatting',  label: 'Cell Formatting'         },
  { id: 'condfmt',     label: 'Conditional Formatting'  },
  { id: 'find',        label: 'Find & Replace'          },
];

const K = ({ children }) => <kbd className={styles.helpKbd}>{children}</kbd>;

const ShortcutTable = ({ rows }) => (
  <table className={styles.helpTable}>
    <tbody>
      {rows.map(([keys, desc]) => (
        <tr key={desc}>
          <td className={styles.helpTableKey}>
            {keys.map((k, i) => (
              <span key={i}>{i > 0 && ' / '}<K>{k}</K></span>
            ))}
          </td>
          <td className={styles.helpTableDesc}>{desc}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const FnTable = ({ rows }) => (
  <table className={styles.helpTable}>
    <thead>
      <tr>
        <th className={styles.helpTh}>Function</th>
        <th className={styles.helpTh}>Description</th>
        <th className={styles.helpTh}>Example</th>
      </tr>
    </thead>
    <tbody>
      {rows.map(([fn, desc, ex]) => (
        <tr key={fn}>
          <td className={styles.helpTableKey}><code className={styles.helpCode}>{fn}</code></td>
          <td className={styles.helpTableDesc}>{desc}</td>
          <td><code className={styles.helpCode}>{ex}</code></td>
        </tr>
      ))}
    </tbody>
  </table>
);

const Ex = ({ children }) => <code className={styles.helpExample}>{children}</code>;

// ── Section content ──────────────────────────────────────────

const CONTENT = {
  overview: (
    <div>
      <h2 className={styles.helpH2}>CSV Editor — Overview</h2>
      <p className={styles.helpP}>
        A full-featured browser-based spreadsheet editor for CSV, TSV, XLSX, and ODS files.
        All data stays in your browser — nothing is uploaded to any server.
      </p>
      <h3 className={styles.helpH3}>Key features</h3>
      <ul className={styles.helpList}>
        <li>Import CSV / TSV / XLSX / ODS files (drag-and-drop or file picker)</li>
        <li>Multi-tab support — each imported workbook sheet becomes a tab</li>
        <li>Excel-like formula engine (<Ex>=SUM(A1:A10)</Ex>, <Ex>=IF(B2&gt;0,"Yes","No")</Ex>, etc.)</li>
        <li>Cell formatting — bold, italic, underline, alignment, text &amp; background colour, number format</li>
        <li>Conditional formatting — highlight cells automatically based on rules</li>
        <li>Find &amp; Replace with match-case and whole-cell options</li>
        <li>Insert / delete rows and columns with formula reference auto-shifting</li>
        <li>Sort any column A→Z or Z→A</li>
        <li>Unlimited undo / redo (50 steps per tab)</li>
        <li>Autosave to browser localStorage with 500 ms debounce</li>
        <li>Export active sheet as CSV</li>
      </ul>
      <h3 className={styles.helpH3}>Quick start</h3>
      <ol className={styles.helpList}>
        <li>Click <strong>Import</strong> or drag a file onto the grid to load data.</li>
        <li>Click a cell to select it. Double-click (or start typing) to edit.</li>
        <li>Type <Ex>=</Ex> to start a formula.</li>
        <li>Click <strong>Save CSV</strong> to download the active sheet.</li>
      </ol>
    </div>
  ),

  navigation: (
    <div>
      <h2 className={styles.helpH2}>Navigation &amp; Selection</h2>
      <h3 className={styles.helpH3}>Moving the cursor</h3>
      <ShortcutTable rows={[
        [['↑ ↓ ← →'],          'Move active cell one step'],
        [['Tab'],               'Move right; wraps to next row at edge'],
        [['Shift+Tab'],         'Move left'],
        [['Enter'],             'Move down'],
        [['Shift+Enter'],       'Move up'],
        [['Home'],              'First column in current row'],
        [['End'],               'Last column in current row'],
        [['Ctrl+Home'],         'Go to cell A1'],
        [['Ctrl+End'],          'Go to last used cell'],
      ]} />
      <h3 className={styles.helpH3}>Selecting a range</h3>
      <ShortcutTable rows={[
        [['Shift+↑/↓/←/→'],    'Extend selection one step'],
        [['Shift+Click'],        'Extend selection to clicked cell'],
        [['Ctrl+A'],             'Select all cells'],
        [['Click row number'],   'Select entire row'],
        [['Click column letter'],'Select entire column'],
        [['+ button (hover)'],  'Appear on row/col headers to extend selection'],
      ]} />
      <p className={styles.helpP}>
        The <strong>active cell</strong> (blue outline) is the anchor for formula entry and formatting.
        The <strong>selected range</strong> (blue highlight) is used for bulk operations like Delete,
        Copy, formatting, and conditional formatting range defaults.
      </p>
    </div>
  ),

  editing: (
    <div>
      <h2 className={styles.helpH2}>Editing Cells</h2>
      <h3 className={styles.helpH3}>Entering edit mode</h3>
      <ShortcutTable rows={[
        [['Double-click'],       'Enter edit mode with current cell value'],
        [['Any printable key'],  'Enter edit mode, replacing content with typed character'],
        [['Formula bar'],        'Click the formula bar to edit the active cell there'],
      ]} />
      <h3 className={styles.helpH3}>Committing / cancelling</h3>
      <ShortcutTable rows={[
        [['Enter'],              'Commit and move down'],
        [['Shift+Enter'],        'Commit and move up'],
        [['Tab'],                'Commit and move right'],
        [['Shift+Tab'],          'Commit and move left'],
        [['Escape'],             'Cancel — discard changes'],
        [['Delete', 'Backspace'],'Clear selected cells (when not in edit mode)'],
      ]} />
      <h3 className={styles.helpH3}>Formula bar</h3>
      <p className={styles.helpP}>
        The formula bar always shows the <strong>raw</strong> value of the active cell
        (e.g. <Ex>=SUM(A1:A5)</Ex> rather than the computed result).
        While typing a formula, click any cell to insert its address automatically.
      </p>
      <h3 className={styles.helpH3}>Undo / Redo</h3>
      <ShortcutTable rows={[
        [['Ctrl+Z'],             'Undo (up to 50 steps per tab)'],
        [['Ctrl+Y', 'Ctrl+Shift+Z'], 'Redo'],
      ]} />
    </div>
  ),

  clipboard: (
    <div>
      <h2 className={styles.helpH2}>Copy, Cut &amp; Paste</h2>
      <ShortcutTable rows={[
        [['Ctrl+C'],   'Copy selected range to clipboard (as tab-separated values)'],
        [['Ctrl+X'],   'Cut — copies and marks cells with a marching-ants border'],
        [['Ctrl+V'],   'Paste at active cell (top-left of destination)'],
        [['Escape'],   'Cancel a pending cut without clearing cells'],
      ]} />
      <h3 className={styles.helpH3}>Notes</h3>
      <ul className={styles.helpList}>
        <li>Copy uses <strong>display values</strong> (computed formula results), not raw formulas — compatible with Excel and Google Sheets.</li>
        <li>Paste expands the grid automatically if the clipboard content is larger than the remaining space.</li>
        <li>Cut clears the source cells only when you paste — if you copy something else first, the cut is cancelled and no cells are cleared.</li>
        <li>Cross-tab and cross-app paste works because the clipboard format is standard TSV.</li>
      </ul>
    </div>
  ),

  rowcol: (
    <div>
      <h2 className={styles.helpH2}>Rows &amp; Columns</h2>
      <h3 className={styles.helpH3}>Insert / delete</h3>
      <p className={styles.helpP}>
        Right-click a <strong>row number</strong> or <strong>column letter</strong> to open the context menu:
      </p>
      <ul className={styles.helpList}>
        <li><strong>Insert row above / below</strong> — inserts at the clicked row</li>
        <li><strong>Delete row(s)</strong> — removes all rows in the current selection</li>
        <li><strong>Insert column left / right</strong></li>
        <li><strong>Delete column(s)</strong></li>
      </ul>
      <p className={styles.helpP}>
        Formula references are automatically adjusted after any insert or delete.
        For example, inserting a row above row 3 shifts <Ex>=A3</Ex> → <Ex>=A4</Ex> in all formulas.
      </p>
      <h3 className={styles.helpH3}>Sort</h3>
      <p className={styles.helpP}>
        Right-click a <strong>column letter</strong> and choose <strong>Sort A→Z</strong> or <strong>Sort Z→A</strong>.
        Numeric values sort numerically; mixed columns sort as text.
      </p>
      <h3 className={styles.helpH3}>Column resize</h3>
      <p className={styles.helpP}>
        Drag the right edge of any column header to resize it. Minimum width is 40 px.
      </p>
    </div>
  ),

  formulas: (
    <div>
      <h2 className={styles.helpH2}>Formulas</h2>
      <p className={styles.helpP}>
        Start any cell value with <Ex>=</Ex> to write a formula.
        Cell references use the <strong>A1 notation</strong> (column letter + row number).
        Ranges use a colon: <Ex>A1:C5</Ex>.
      </p>

      <h3 className={styles.helpH3}>Basic examples</h3>
      <table className={styles.helpTable}>
        <thead><tr>
          <th className={styles.helpTh}>Formula</th>
          <th className={styles.helpTh}>Result</th>
        </tr></thead>
        <tbody>
          {[
            ['=A1+B1',               'Sum of two cells'],
            ['=SUM(A1:A10)',          'Total of A1 through A10'],
            ['=AVERAGE(B1:B20)',      'Mean of B1:B20'],
            ['=IF(C2>100,"High","Low")', 'Text based on condition'],
            ['=A1&" "&B1',           'Concatenate two text cells'],
            ['=TODAY()',              'Today\'s date'],
            ['=VLOOKUP(E1,A:B,2,0)', 'Lookup value in table'],
          ].map(([f, d]) => (
            <tr key={f}>
              <td><code className={styles.helpCode}>{f}</code></td>
              <td className={styles.helpTableDesc}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.helpH3}>Math &amp; Statistics</h3>
      <FnTable rows={[
        ['SUM(range)',           'Sum of values',                        '=SUM(A1:A10)'],
        ['AVERAGE(range)',       'Arithmetic mean',                      '=AVERAGE(B1:B20)'],
        ['MIN(range)',           'Smallest value',                       '=MIN(C1:C50)'],
        ['MAX(range)',           'Largest value',                        '=MAX(C1:C50)'],
        ['COUNT(range)',         'Count numeric cells',                  '=COUNT(A1:A100)'],
        ['COUNTA(range)',        'Count non-empty cells',                '=COUNTA(A1:A100)'],
        ['COUNTIF(range,crit)',  'Count cells matching criterion',       '=COUNTIF(A1:A10,">0")'],
        ['ROUND(n,digits)',      'Round to N decimal places',            '=ROUND(3.14159,2)'],
        ['ROUNDUP(n,digits)',    'Always round up',                      '=ROUNDUP(1.1,0)'],
        ['ROUNDDOWN(n,digits)',  'Always round down',                    '=ROUNDDOWN(1.9,0)'],
        ['ABS(n)',               'Absolute value',                       '=ABS(-5)'],
        ['SQRT(n)',              'Square root',                          '=SQRT(16)'],
        ['POWER(base,exp)',      'Exponentiation',                       '=POWER(2,10)'],
        ['MOD(n,divisor)',       'Remainder after division',             '=MOD(10,3)'],
        ['INT(n)',               'Round down to integer',                '=INT(3.9)'],
        ['PRODUCT(range)',       'Product of values',                    '=PRODUCT(A1:A5)'],
        ['STDEV(range)',         'Sample standard deviation',            '=STDEV(B1:B20)'],
        ['MEDIAN(range)',        'Middle value',                         '=MEDIAN(C1:C10)'],
        ['LARGE(range,k)',       'k-th largest value',                   '=LARGE(A1:A10,2)'],
        ['SMALL(range,k)',       'k-th smallest value',                  '=SMALL(A1:A10,2)'],
      ]} />

      <h3 className={styles.helpH3}>Logical</h3>
      <FnTable rows={[
        ['IF(test,yes,no)',           'Return yes if test is true, else no',   '=IF(A1>0,"Profit","Loss")'],
        ['IFERROR(val,fallback)',     'Return fallback if val is an error',     '=IFERROR(A1/B1,0)'],
        ['AND(a,b,...)',              'True only if all arguments are true',    '=AND(A1>0,B1>0)'],
        ['OR(a,b,...)',               'True if any argument is true',           '=OR(A1="Y",B1="Y")'],
        ['NOT(val)',                  'Inverts a logical value',                '=NOT(A1=0)'],
      ]} />

      <h3 className={styles.helpH3}>Text</h3>
      <FnTable rows={[
        ['LEN(text)',            'Number of characters',                 '=LEN(A1)'],
        ['LEFT(text,n)',         'First n characters',                   '=LEFT(A1,3)'],
        ['RIGHT(text,n)',        'Last n characters',                    '=RIGHT(A1,4)'],
        ['MID(text,start,n)',    'n chars starting at position',        '=MID(A1,2,5)'],
        ['UPPER(text)',          'Convert to upper case',                '=UPPER(A1)'],
        ['LOWER(text)',          'Convert to lower case',                '=LOWER(A1)'],
        ['TRIM(text)',           'Remove extra whitespace',              '=TRIM(A1)'],
        ['CONCATENATE(a,b,...)', 'Join text values',                    '=CONCATENATE(A1," ",B1)'],
        ['SUBSTITUTE(t,old,new)','Replace text occurrences',            '=SUBSTITUTE(A1,"old","new")'],
        ['FIND(find,text)',      'Position of substring (case-sensitive)','=FIND("@",A1)'],
        ['TEXT(val,format)',     'Format number as text',               '=TEXT(A1,"0.00")'],
      ]} />

      <h3 className={styles.helpH3}>Lookup</h3>
      <FnTable rows={[
        ['VLOOKUP(val,range,col,0)', 'Exact-match lookup in leftmost column', '=VLOOKUP(E1,A:C,2,0)'],
        ['INDEX(range,row,col)',     'Value at row/col in range',             '=INDEX(A1:C10,3,2)'],
        ['MATCH(val,range,0)',       'Position of value in range',            '=MATCH("Bob",A1:A10,0)'],
        ['ROW()',                    'Row number of current cell',            '=ROW()'],
        ['COLUMN()',                 'Column number of current cell',         '=COLUMN()'],
      ]} />

      <h3 className={styles.helpH3}>Error values</h3>
      <table className={styles.helpTable}>
        <thead><tr>
          <th className={styles.helpTh}>Error</th>
          <th className={styles.helpTh}>Meaning</th>
          <th className={styles.helpTh}>Fix</th>
        </tr></thead>
        <tbody>
          {[
            ['#DIV/0!', 'Division by zero',           'Wrap with =IFERROR(...,0)'],
            ['#VALUE!', 'Wrong value type',            'Check that cells contain numbers where expected'],
            ['#REF!',   'Invalid cell reference',      'Reference points outside the grid'],
            ['#NAME?',  'Unknown function name',       'Check spelling of the function'],
            ['#NUM!',   'Invalid numeric value',       'e.g. SQRT of a negative number'],
            ['#N/A',    'Value not found',             'VLOOKUP found no match'],
            ['#CIRC',   'Circular reference',          'Formula refers to itself (directly or indirectly)'],
          ].map(([e, m, f]) => (
            <tr key={e}>
              <td><code className={[styles.helpCode, styles.helpError].join(' ')}>{e}</code></td>
              <td className={styles.helpTableDesc}>{m}</td>
              <td className={styles.helpTableDesc}>{f}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),

  formatting: (
    <div>
      <h2 className={styles.helpH2}>Cell Formatting</h2>
      <p className={styles.helpP}>
        Select one or more cells, then use the <strong>format bar</strong> (below the tab bar) or keyboard shortcuts.
        Formatting is per-cell and is saved with the session.
      </p>
      <h3 className={styles.helpH3}>Keyboard shortcuts</h3>
      <ShortcutTable rows={[
        [['Ctrl+B'], 'Toggle Bold'],
        [['Ctrl+I'], 'Toggle Italic'],
        [['Ctrl+U'], 'Toggle Underline'],
      ]} />
      <h3 className={styles.helpH3}>Format bar buttons</h3>
      <table className={styles.helpTable}>
        <thead><tr>
          <th className={styles.helpTh}>Button</th>
          <th className={styles.helpTh}>What it does</th>
        </tr></thead>
        <tbody>
          {[
            ['B',      'Bold — all selected cells must be bold to show as active; clicking sets bold on all'],
            ['I',      'Italic — same toggle logic'],
            ['U',      'Underline'],
            ['L C R',  'Align left / centre / right (uses anchor cell to show current alignment)'],
            ['A (bar)','Text colour picker — colour bar shows current anchor cell colour; ✕ clears it'],
            ['H (bar)','Background colour — same pattern'],
            ['CF',     'Open the Conditional Formatting dialog'],
            ['Dropdown','Number format: General · Integer · 0.00 · % · $'],
          ].map(([b, d]) => (
            <tr key={b}>
              <td className={styles.helpTableKey}><strong>{b}</strong></td>
              <td className={styles.helpTableDesc}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className={styles.helpH3}>Number formats</h3>
      <table className={styles.helpTable}>
        <thead><tr>
          <th className={styles.helpTh}>Format</th>
          <th className={styles.helpTh}>Raw value</th>
          <th className={styles.helpTh}>Displayed as</th>
        </tr></thead>
        <tbody>
          {[
            ['General', '1234.5',  '1234.5  (unchanged)'],
            ['Integer', '1234.5',  '1,235'],
            ['0.00',    '3.14159', '3.14'],
            ['%',       '0.75',    '0.75%  (value is shown as-is + %)'],
            ['$',       '9.99',    '$9.99'],
          ].map(([f, r, d]) => (
            <tr key={f}>
              <td className={styles.helpTableKey}>{f}</td>
              <td><code className={styles.helpCode}>{r}</code></td>
              <td className={styles.helpTableDesc}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.helpP}>
        Number formats only affect the <em>display</em> — the underlying raw value is always preserved for formulas.
      </p>
    </div>
  ),

  condfmt: (
    <div>
      <h2 className={styles.helpH2}>Conditional Formatting</h2>
      <p className={styles.helpP}>
        Conditional formatting automatically highlights cells based on their values.
        Click the <strong>CF</strong> button in the format bar to open the dialog.
      </p>
      <h3 className={styles.helpH3}>How it works</h3>
      <ol className={styles.helpList}>
        <li>Click <strong>+ Add Rule</strong> in the dialog.</li>
        <li>Choose whether to apply to <strong>all cells</strong> or a specific range (e.g. <Ex>B2:B50</Ex>).</li>
        <li>Select a <strong>condition</strong> and enter value(s).</li>
        <li>Pick a <strong>background colour</strong>, <strong>text colour</strong>, or <strong>bold/italic</strong> style.</li>
        <li>Click <strong>Add rule</strong>. The highlight appears immediately.</li>
      </ol>
      <p className={styles.helpP}>
        Rules are evaluated <strong>top-to-bottom</strong>; the first matching rule wins for each cell.
        Manual cell styles override conditional formatting for the same property.
      </p>
      <p className={styles.helpP}>
        Every new sheet starts with a default <strong>zebra-stripe</strong> rule
        (even rows get a light blue background). You can edit or delete it in the dialog.
      </p>
      <h3 className={styles.helpH3}>Condition types</h3>
      <table className={styles.helpTable}>
        <thead><tr>
          <th className={styles.helpTh}>Condition</th>
          <th className={styles.helpTh}>Applies when cell value…</th>
          <th className={styles.helpTh}>Example input</th>
        </tr></thead>
        <tbody>
          {[
            ['Greater than',            'is numerically greater than value',   '100'],
            ['Less than',               'is numerically less than value',      '0'],
            ['Greater than or equal to','≥ value',                             '50'],
            ['Less than or equal to',   '≤ value',                             '10'],
            ['Equal to',                'equals value (number or text)',        'Pass'],
            ['Not equal to',            'does not equal value',                'N/A'],
            ['Between',                 'is in [From, To] range inclusive',    '1 and 100'],
            ['Contains text',           'cell text includes the substring',    'error'],
            ['Does not contain text',   'cell text does not include substring','ok'],
            ['Is empty',                'cell is blank',                       '(no input)'],
            ['Is not empty',            'cell has any value',                  '(no input)'],
            ['Row is even',             'row number is 2, 4, 6, … (1-based)',  '(no input)'],
            ['Row is odd',              'row number is 1, 3, 5, … (1-based)',  '(no input)'],
          ].map(([c, a, e]) => (
            <tr key={c}>
              <td className={styles.helpTableKey}>{c}</td>
              <td className={styles.helpTableDesc}>{a}</td>
              <td><code className={styles.helpCode}>{e}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className={styles.helpH3}>Practical examples</h3>
      <table className={styles.helpTable}>
        <thead><tr>
          <th className={styles.helpTh}>Goal</th>
          <th className={styles.helpTh}>Range</th>
          <th className={styles.helpTh}>Condition</th>
          <th className={styles.helpTh}>Style</th>
        </tr></thead>
        <tbody>
          {[
            ['Highlight negative sales',    'B2:B100',   'Less than 0',      'Red background'],
            ['Flag missing data',           'All cells', 'Is empty',         'Yellow background'],
            ['Mark top scores (> 90)',      'C2:C30',    'Greater than 90',  'Green bg, bold'],
            ['Flag overdue items',          'D2:D50',    'Equal to "Overdue"','Orange bg, italic'],
            ['Show values in range 1–10',   'A1:A20',    'Between 1 and 10', 'Blue text'],
            ['Highlight errors in formulas','E2:E100',   'Contains #',       'Red text, bold'],
          ].map(([g, r, c, s]) => (
            <tr key={g}>
              <td className={styles.helpTableDesc}>{g}</td>
              <td><code className={styles.helpCode}>{r}</code></td>
              <td className={styles.helpTableDesc}>{c}</td>
              <td className={styles.helpTableDesc}>{s}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),

  find: (
    <div>
      <h2 className={styles.helpH2}>Find &amp; Replace</h2>
      <h3 className={styles.helpH3}>Opening</h3>
      <ShortcutTable rows={[
        [['Ctrl+F'], 'Open Find panel'],
        [['Ctrl+H'], 'Open Find & Replace panel'],
      ]} />
      <h3 className={styles.helpH3}>Navigation</h3>
      <ShortcutTable rows={[
        [['↑ / ↓ buttons'], 'Jump to previous / next match'],
        [['Escape'],         'Close the find panel'],
      ]} />
      <h3 className={styles.helpH3}>Options</h3>
      <table className={styles.helpTable}>
        <tbody>
          {[
            ['Match case',  'Distinguishes upper- and lower-case letters'],
            ['Whole cell',  'Only matches if the entire cell value equals the query (not just contains it)'],
            ['Replace mode','Adds a Replace field; use Replace or Replace All buttons'],
          ].map(([o, d]) => (
            <tr key={o}>
              <td className={styles.helpTableKey}>{o}</td>
              <td className={styles.helpTableDesc}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className={styles.helpH3}>Tips</h3>
      <ul className={styles.helpList}>
        <li>Matches are highlighted in yellow; the current match is highlighted orange.</li>
        <li><strong>Replace All</strong> replaces every match in one undo step.</li>
        <li>The match count is shown next to the search field (e.g. <em>3 / 12</em>).</li>
        <li>Find searches the raw cell value, not the computed formula result.</li>
      </ul>
    </div>
  ),
};

export default function HelpDialog({ onClose }) {
  const [active, setActive] = useState('overview');

  return (
    <div className={styles.helpOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.helpDialog}>
        <div className={styles.helpHeader}>
          <span>Help &amp; Reference</span>
          <button className={styles.helpClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.helpBody}>
          <nav className={styles.helpNav}>
            {NAV.map(({ id, label }) => (
              <button
                key={id}
                className={[styles.helpNavItem, active === id ? styles.helpNavActive : ''].filter(Boolean).join(' ')}
                onClick={() => setActive(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className={styles.helpContent}>
            {CONTENT[active]}
          </div>
        </div>
      </div>
    </div>
  );
}
