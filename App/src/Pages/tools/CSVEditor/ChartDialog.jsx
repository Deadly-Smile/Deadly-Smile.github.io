import { useState, useMemo } from 'react';
import styles from './CSVEditor.module.css';

const PALETTE = ['#1a73e8', '#e84534', '#34a853', '#fbbc04', '#9c27b0', '#ff6d00', '#00bcd4', '#795548'];

const W = 520, H = 290;
const PAD = { top: 20, right: 20, bottom: 46, left: 52 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

// ── Data parsing ─────────────────────────────────────────────────

function parseChartData(raw, hasHeaders) {
  if (!raw?.length || !raw[0]?.length || raw[0].length < 2) {
    return { labels: [], series: [] };
  }
  const rows = hasHeaders && raw.length > 1 ? raw.slice(1) : raw;
  const names = hasHeaders
    ? raw[0].slice(1).map((n, i) => n || `Series ${i + 1}`)
    : raw[0].slice(1).map((_, i) => `Series ${i + 1}`);

  const labels = rows.map((r) => String(r[0] ?? ''));
  const series = names.map((name, si) => ({
    name,
    values: rows.map((r) => {
      const v = parseFloat(String(r[si + 1] ?? '').replace(/,/g, ''));
      return isNaN(v) ? 0 : v;
    }),
  }));
  return { labels, series };
}

// ── Helpers ──────────────────────────────────────────────────────

const fmtN = (v) => {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return v % 1 !== 0 ? v.toFixed(1) : String(v);
};

function makeYScale(allValues) {
  const max = Math.max(...allValues, 0);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const toY = (v) => PAD.top + PH - ((v - min) / range) * PH;
  const ticks = [0, 1, 2, 3, 4].map((i) => min + (range / 4) * i);
  return { min, max, range, toY, zeroY: toY(0), ticks };
}

// ── Shared SVG sub-components ────────────────────────────────────

function YTicks({ ticks, toY }) {
  return ticks.map((tick, i) => {
    const y = toY(tick);
    return (
      <g key={i}>
        <line x1={PAD.left} x2={PAD.left + PW} y1={y} y2={y} stroke="#ebebeb" strokeWidth={0.5} />
        <text x={PAD.left - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill="#888">
          {fmtN(tick)}
        </text>
      </g>
    );
  });
}

function XLabels({ labels }) {
  const step = PW / labels.length;
  return labels.map((lbl, i) => (
    <text
      key={i}
      x={PAD.left + (i + 0.5) * step}
      y={H - PAD.bottom + 14}
      textAnchor="middle"
      fontSize={9}
      fill="#555"
    >
      {String(lbl).slice(0, 12)}
    </text>
  ));
}

function Axes({ zeroY }) {
  const inPlot = zeroY > PAD.top + 0.5 && zeroY < PAD.top + PH - 0.5;
  return (
    <>
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PH} stroke="#ccc" strokeWidth={1} />
      <line x1={PAD.left} x2={PAD.left + PW} y1={PAD.top + PH} y2={PAD.top + PH} stroke="#ccc" strokeWidth={1} />
      {inPlot && (
        <line
          x1={PAD.left} x2={PAD.left + PW}
          y1={zeroY} y2={zeroY}
          stroke="#aaa" strokeWidth={0.8} strokeDasharray="4 2"
        />
      )}
    </>
  );
}

// ── Chart renderers ───────────────────────────────────────────────

function BarChart({ labels, series }) {
  const sc = makeYScale(series.flatMap((s) => s.values));
  const groupW = PW / labels.length;
  const nS = series.length;
  const totalBW = groupW * 0.78;
  const barW = Math.min(totalBW / nS, 48);
  const off = (groupW - barW * nS) / 2;

  return (
    <>
      <YTicks ticks={sc.ticks} toY={sc.toY} />
      {labels.map((_, gi) =>
        series.map((s, si) => {
          const val = s.values[gi] ?? 0;
          const x = PAD.left + gi * groupW + off + si * barW;
          const y1 = sc.toY(Math.max(val, 0));
          const y2 = sc.toY(Math.min(val, 0));
          return (
            <rect
              key={`${gi}-${si}`}
              x={x + 0.5} y={Math.min(y1, y2)}
              width={Math.max(barW - 1, 1)}
              height={Math.max(Math.abs(y2 - y1), 1)}
              fill={PALETTE[si % PALETTE.length]}
              opacity={0.85}
            />
          );
        })
      )}
      <XLabels labels={labels} />
      <Axes zeroY={sc.zeroY} />
    </>
  );
}

function LineChart({ labels, series, filled }) {
  const sc = makeYScale(series.flatMap((s) => s.values));
  const step = PW / labels.length;
  const xOf = (i) => PAD.left + (i + 0.5) * step;
  const bottomY = PAD.top + PH;

  return (
    <>
      <YTicks ticks={sc.ticks} toY={sc.toY} />
      {series.map((s, si) => {
        const color = PALETTE[si % PALETTE.length];
        const pts = s.values.map((v, i) => `${xOf(i)},${sc.toY(v)}`).join(' ');
        const areaPts = [
          `${xOf(0)},${bottomY}`,
          ...s.values.map((v, i) => `${xOf(i)},${sc.toY(v)}`),
          `${xOf(labels.length - 1)},${bottomY}`,
        ].join(' ');
        return (
          <g key={si}>
            {filled && <polygon points={areaPts} fill={color} opacity={0.15} />}
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={xOf(i)} cy={sc.toY(v)} r={3} fill={color} stroke="#fff" strokeWidth={1} />
            ))}
          </g>
        );
      })}
      <XLabels labels={labels} />
      <Axes zeroY={sc.zeroY} />
    </>
  );
}

function PieChart({ labels, series }) {
  const vals = series[0].values.map((v) => Math.abs(v));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const cx = W / 2, cy = H / 2 - 2;
  const r = Math.min(PW, PH) / 2 - 6;

  let angle = -Math.PI / 2;
  const slices = labels.map((lbl, i) => {
    const frac = vals[i] / total;
    const start = angle;
    const end = (angle += frac * Math.PI * 2);
    const mid = (start + end) / 2;
    const x1 = (cx + r * Math.cos(start)).toFixed(2);
    const y1 = (cy + r * Math.sin(start)).toFixed(2);
    const x2 = (cx + r * Math.cos(end)).toFixed(2);
    const y2 = (cy + r * Math.sin(end)).toFixed(2);
    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`,
      color: PALETTE[i % PALETTE.length],
      pct: Math.round(frac * 100),
      lx: cx + r * 0.62 * Math.cos(mid),
      ly: cy + r * 0.62 * Math.sin(mid),
      frac,
    };
  });

  return (
    <>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1.5} />
      ))}
      {slices.map((s, i) =>
        s.frac > 0.04 ? (
          <text key={i} x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff" fontWeight="600">
            {s.pct}%
          </text>
        ) : null
      )}
    </>
  );
}

function NoData() {
  return (
    <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#ccc">
      Select a range with at least 2 columns
    </text>
  );
}

// ── Dialog ────────────────────────────────────────────────────────

const CHART_TYPES = [
  { key: 'bar', label: 'Bar' },
  { key: 'line', label: 'Line' },
  { key: 'area', label: 'Area' },
  { key: 'pie', label: 'Pie' },
];

export default function ChartDialog({ rawData, onClose }) {
  const [chartType, setChartType] = useState('bar');
  const [hasHeaders, setHasHeaders] = useState(true);

  const { labels, series } = useMemo(
    () => parseChartData(rawData, hasHeaders),
    [rawData, hasHeaders]
  );

  const hasData =
    labels.length > 0 &&
    series.length > 0 &&
    series.some((s) => s.values.some((v) => v !== 0));

  let chart = <NoData />;
  if (hasData) {
    if (chartType === 'bar') chart = <BarChart labels={labels} series={series} />;
    else if (chartType === 'line') chart = <LineChart labels={labels} series={series} filled={false} />;
    else if (chartType === 'area') chart = <LineChart labels={labels} series={series} filled />;
    else if (chartType === 'pie') chart = <PieChart labels={labels} series={series} />;
  }

  const legendItems =
    hasData && chartType === 'pie'
      ? labels.map((lbl, i) => ({ label: lbl, color: PALETTE[i % PALETTE.length] }))
      : hasData && series.length > 1
      ? series.map((s, i) => ({ label: s.name, color: PALETTE[i % PALETTE.length] }))
      : [];

  return (
    <div className={styles.cfOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.cfDialog} style={{ width: 580 }}>
        <div className={styles.cfHeader}>
          <span>Chart</span>
          <button className={styles.cfClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.cfBody} style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.key}
                className={chartType === ct.key ? styles.cfApplyBtn : styles.cfCancelBtn}
                onClick={() => setChartType(ct.key)}
                style={{ padding: '3px 14px', minWidth: 0 }}
              >
                {ct.label}
              </button>
            ))}
            <label className={styles.cfCheckLabel} style={{ marginLeft: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={hasHeaders}
                onChange={(e) => setHasHeaders(e.target.checked)}
              />
              First row is header
            </label>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ border: '1px solid #e8e8e8', borderRadius: 4, background: '#fafafa', display: 'block' }}
          >
            {chart}
          </svg>

          {legendItems.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#444' }}>
              {legendItems.map((item, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      display: 'inline-block', width: 10, height: 10,
                      borderRadius: 2, background: item.color, flexShrink: 0,
                    }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
