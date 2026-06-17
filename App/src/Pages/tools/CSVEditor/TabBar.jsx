import { useState, useRef } from 'react';
import styles from './CSVEditor.module.css';

export default function TabBar({ tabs, activeTabId, dispatch }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const dragIdxRef = useRef(null); // current dragged-tab position (not render state)

  const startRename = (tab, e) => {
    e.stopPropagation();
    setRenamingId(tab.id);
    setRenameValue(tab.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      dispatch({ type: 'RENAME_TAB', payload: { tabId: renamingId, name: renameValue.trim() } });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const startDrag = (e, fromIdx) => {
    // Only respond to left mouse button; ignore rename input drags
    if (e.button !== 0 || renamingId) return;
    e.preventDefault();
    dragIdxRef.current = fromIdx;

    const onMove = (mv) => {
      const el = document.elementFromPoint(mv.clientX, mv.clientY);
      const tabEl = el?.closest('[data-tabidx]');
      if (!tabEl) return;
      const toIdx = parseInt(tabEl.dataset.tabidx, 10);
      if (!isNaN(toIdx) && toIdx !== dragIdxRef.current) {
        dispatch({ type: 'REORDER_TABS', payload: { fromIdx: dragIdxRef.current, toIdx } });
        dragIdxRef.current = toIdx;
      }
    };

    const onUp = () => {
      dragIdxRef.current = null;
      document.removeEventListener('mousemove', onMove);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };

  return (
    <div className={styles.tabBar}>
      {tabs.map((tab, idx) => (
        <div
          key={tab.id}
          data-tabidx={idx}
          className={[styles.tab, tab.id === activeTabId ? styles.tabActive : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: tab.id } })}
          onMouseDown={(e) => startDrag(e, idx)}
        >
          {renamingId === tab.id ? (
            <input
              className={styles.tabInput}
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') commitRename();
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={styles.tabLabel} onDoubleClick={(e) => startRename(tab, e)}>
              {tab.name}
            </span>
          )}
          <button
            className={styles.tabClose}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'REMOVE_TAB', payload: { tabId: tab.id } });
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
