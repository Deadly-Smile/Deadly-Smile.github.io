import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { colLabel } from './utils.js';
import styles from './CSVEditor.module.css';

const FormulaBar = forwardRef(function FormulaBar({ active, rawValue, onCommit, onEditingChange }, ref) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const escapedRef = useRef(false);
  const inputRef = useRef(null);
  // Keep a ref in sync so insertText always sees the latest value
  const editValRef = useRef('');

  const setEditValBoth = (val) => {
    setEditVal(val);
    editValRef.current = val;
  };

  const setEditingBoth = (val) => {
    setEditing(val);
    onEditingChange?.(val);
  };

  // Expose insertText to parent so grid cell clicks can inject cell addresses
  useImperativeHandle(ref, () => ({
    insertText(text) {
      const el = inputRef.current;
      if (!el) return;
      const start = el.selectionStart ?? editValRef.current.length;
      const end = el.selectionEnd ?? editValRef.current.length;
      const newVal = editValRef.current.slice(0, start) + text + editValRef.current.slice(end);
      setEditValBoth(newVal);
      // Restore cursor after the inserted text
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + text.length, start + text.length);
      });
    },
  }));

  // Stop editing when active cell changes (navigated away)
  useEffect(() => {
    setEditingBoth(false);
  }, [active.row, active.col]); // eslint-disable-line react-hooks/exhaustive-deps

  const cellAddr = `${colLabel(active.col)}${active.row + 1}`;

  const handleFocus = () => {
    setEditValBoth(rawValue);
    setEditingBoth(true);
  };

  const handleCommit = () => {
    onCommit(active.row, active.col, editValRef.current);
    setEditingBoth(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
      e.target.blur();
    } else if (e.key === 'Escape') {
      escapedRef.current = true;
      setEditingBoth(false);
      e.target.blur();
    }
  };

  const handleBlur = () => {
    if (escapedRef.current) {
      escapedRef.current = false;
      setEditingBoth(false);
      return;
    }
    if (editing) handleCommit();
  };

  return (
    <div className={styles.formulaBar}>
      <span className={styles.formulaBarAddr}>{cellAddr}</span>
      <span className={styles.formulaBarFx}>fx</span>
      <input
        ref={inputRef}
        className={styles.formulaBarInput}
        value={editing ? editVal : rawValue}
        onChange={(e) => setEditValBoth(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
    </div>
  );
});

export default FormulaBar;
