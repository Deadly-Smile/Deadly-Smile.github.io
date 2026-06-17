import { useEffect, useRef } from 'react';
import styles from './CSVEditor.module.css';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <ul ref={ref} className={styles.contextMenu} style={{ left: x, top: y }}>
      {items.map((item, i) =>
        item.separator ? (
          <li key={i} className={styles.contextMenuSeparator} />
        ) : (
          <li key={i} className={styles.contextMenuItem} onClick={() => { item.action(); onClose(); }}>
            {item.label}
          </li>
        )
      )}
    </ul>
  );
}
