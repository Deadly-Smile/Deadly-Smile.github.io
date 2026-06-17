import { useRef, useEffect } from 'react';
import styles from './CSVEditor.module.css';

export default function FindReplace({
  mode, onModeToggle,
  query, onQueryChange,
  replaceText, onReplaceTextChange,
  matchCase, onMatchCaseToggle,
  wholeCell, onWholeCellToggle,
  matchCount, currentIdx,
  onPrev, onNext, onReplace, onReplaceAll, onClose,
}) {
  const queryRef = useRef(null);

  useEffect(() => {
    queryRef.current?.focus();
    queryRef.current?.select();
  }, []);

  const countLabel = !query
    ? ''
    : matchCount === 0
    ? 'No results'
    : `${currentIdx + 1} / ${matchCount}`;

  return (
    <div className={styles.findPanel}>
      <div className={styles.findRow}>
        <input
          ref={queryRef}
          className={styles.findInput}
          placeholder="Find"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
            if (e.key === 'Escape') onClose();
          }}
        />
        <span className={styles.findCount}>{countLabel}</span>
        <button className={styles.findNavBtn} onClick={onPrev} title="Previous match (Shift+Enter)">↑</button>
        <button className={styles.findNavBtn} onClick={onNext} title="Next match (Enter)">↓</button>
        <button className={styles.findCloseBtn} onClick={onClose} title="Close (Escape)">✕</button>
      </div>

      {mode === 'replace' && (
        <div className={styles.findRow}>
          <input
            className={styles.findInput}
            placeholder="Replace with"
            value={replaceText}
            onChange={(e) => onReplaceTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onReplace(); }
              if (e.key === 'Escape') onClose();
            }}
          />
          <button className={styles.findActionBtn} onClick={onReplace} disabled={matchCount === 0}>
            Replace
          </button>
          <button className={styles.findActionBtn} onClick={onReplaceAll} disabled={matchCount === 0}>
            Replace all
          </button>
        </div>
      )}

      <div className={styles.findOptions}>
        <label className={styles.findOption}>
          <input type="checkbox" checked={matchCase} onChange={onMatchCaseToggle} />
          {' '}Case
        </label>
        <label className={styles.findOption}>
          <input type="checkbox" checked={wholeCell} onChange={onWholeCellToggle} />
          {' '}Whole cell
        </label>
        <button
          className={[styles.findActionBtn, mode === 'replace' ? styles.findActionBtnActive : ''].filter(Boolean).join(' ')}
          onClick={onModeToggle}
        >
          Replace
        </button>
      </div>
    </div>
  );
}
