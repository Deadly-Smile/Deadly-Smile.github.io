import { useRef } from 'react';
import styles from './CSVEditor.module.css';

const NUM_FMTS = [
  { value: '',      label: 'General' },
  { value: 'int',   label: 'Integer' },
  { value: 'fixed', label: '0.00'    },
  { value: 'pct',   label: '%'       },
  { value: 'usd',   label: '$'       },
];

export default function FormatBar({ activeStyles, onStyle, onToggle, onCfOpen }) {
  const textColorRef = useRef(null);
  const bgColorRef   = useRef(null);

  const fmtBtn = (active, ...rest) =>
    [styles.fmtBtn, active ? styles.fmtBtnOn : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.formatBar}>
      {/* Bold / Italic / Underline */}
      <button
        className={fmtBtn(activeStyles.bold)}
        onMouseDown={(e) => { e.preventDefault(); onToggle('bold'); }}
        title="Bold (Ctrl+B)"
        style={{ fontWeight: 'bold' }}
      >B</button>
      <button
        className={fmtBtn(activeStyles.italic)}
        onMouseDown={(e) => { e.preventDefault(); onToggle('italic'); }}
        title="Italic (Ctrl+I)"
        style={{ fontStyle: 'italic' }}
      >I</button>
      <button
        className={fmtBtn(activeStyles.underline)}
        onMouseDown={(e) => { e.preventDefault(); onToggle('underline'); }}
        title="Underline (Ctrl+U)"
        style={{ textDecoration: 'underline' }}
      >U</button>

      <div className={styles.fmtSep} />

      {/* Alignment */}
      {[
        { v: 'left',   icon: '⬛≡',  title: 'Align left'   },
        { v: 'center', icon: '≡■≡', title: 'Align center' },
        { v: 'right',  icon: '≡■', title: 'Align right'  },
      ].map(({ v, title }) => (
        <button
          key={v}
          className={fmtBtn(activeStyles.align === v)}
          onMouseDown={(e) => { e.preventDefault(); onStyle({ align: activeStyles.align === v ? '' : v }); }}
          title={title}
        >
          {v === 'left' ? 'L' : v === 'center' ? 'C' : 'R'}
        </button>
      ))}

      <div className={styles.fmtSep} />

      {/* Text colour */}
      <span className={styles.colorWrap} title="Text colour">
        <button
          className={styles.fmtBtn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => textColorRef.current?.click()}
          style={{ '--swatch': activeStyles.color || 'transparent' }}
        >
          <span className={styles.colorLabel}>A</span>
          <span
            className={styles.colorBar}
            style={{ background: activeStyles.color || '#000' }}
          />
        </button>
        <input
          ref={textColorRef}
          type="color"
          className={styles.hiddenColor}
          value={activeStyles.color || '#000000'}
          onChange={(e) => onStyle({ color: e.target.value })}
        />
        {activeStyles.color && (
          <button
            className={styles.colorClear}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onStyle({ color: '' })}
            title="Clear text colour"
          >✕</button>
        )}
      </span>

      {/* Background colour */}
      <span className={styles.colorWrap} title="Background colour">
        <button
          className={styles.fmtBtn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bgColorRef.current?.click()}
        >
          <span className={styles.colorLabel}>H</span>
          <span
            className={styles.colorBar}
            style={{ background: activeStyles.bg || 'transparent', border: activeStyles.bg ? 'none' : '1px solid #ccc' }}
          />
        </button>
        <input
          ref={bgColorRef}
          type="color"
          className={styles.hiddenColor}
          value={activeStyles.bg || '#ffffff'}
          onChange={(e) => onStyle({ bg: e.target.value })}
        />
        {activeStyles.bg && (
          <button
            className={styles.colorClear}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onStyle({ bg: '' })}
            title="Clear background colour"
          >✕</button>
        )}
      </span>

      <div className={styles.fmtSep} />

      {/* Conditional formatting */}
      <div className={styles.fmtSep} />
      <button
        className={styles.fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCfOpen}
        title="Conditional formatting"
        style={{ fontSize: '11px', padding: '0 6px' }}
      >CF</button>

      <div className={styles.fmtSep} />

      {/* Number format */}
      <select
        className={styles.fmtSelect}
        value={activeStyles.numFmt || ''}
        onChange={(e) => onStyle({ numFmt: e.target.value })}
        title="Number format"
      >
        {NUM_FMTS.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
