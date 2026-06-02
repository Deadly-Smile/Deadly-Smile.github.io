import { useState, useEffect, useRef } from 'react';
import { ActionBtn, StatusBar } from './tk-shared';

const DEVICES = [
  { id: 'microphone', icon: '🎙', label: 'Microphone' },
  { id: 'webcam',     icon: '📷', label: 'Webcam'     },
  { id: 'keyboard',   icon: '⌨',  label: 'Keyboard'   },
  { id: 'mouse',      icon: '🖱',  label: 'Mouse'      },
  { id: 'touchscreen',icon: '👆', label: 'Touchscreen' },
  { id: 'gamepad',    icon: '🎮', label: 'Gamepad'     },
  { id: 'battery',    icon: '🔋', label: 'Battery'     },
  { id: 'network',    icon: '📶', label: 'Network'     },
];

const BADGE = {
  pending:  { bg: 'var(--tk-surface2)',   color: 'var(--tk-text-dim)',    label: 'Pending'  },
  checking: { bg: 'var(--tk-surface2)',   color: 'var(--tk-text-dim)',    label: 'Checking…'},
  ok:       { bg: 'rgba(34,197,94,0.15)', color: '#4ade80',               label: 'OK'       },
  denied:   { bg: 'rgba(234,179,8,0.15)', color: '#facc15',               label: 'Denied'   },
  error:    { bg: 'rgba(239,68,68,0.15)', color: '#f87171',               label: 'Error'    },
  na:       { bg: 'var(--tk-surface2)',   color: 'var(--tk-text-dim)',    label: 'N/A'      },
};

function Badge({ type }) {
  const b = BADGE[type] || BADGE.pending;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.55rem',
      borderRadius: 'var(--tk-radius)',
      background: b.bg,
      color: b.color,
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      {b.label}
    </span>
  );
}

function MeterBar({ value }) {
  return (
    <div style={{
      height: 4,
      background: 'var(--tk-border)',
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: 6,
    }}>
      <div style={{
        height: '100%',
        width: `${value}%`,
        background: value > 20 ? '#4ade80' : '#f87171',
        borderRadius: 2,
        transition: 'width 0.1s',
      }} />
    </div>
  );
}

export default function InputDeviceChecker() {
  const [results, setResults] = useState(() =>
    Object.fromEntries(DEVICES.map(d => [d.id, { badge: 'pending', detail: '—', extra: null }]))
  );
  const [status, setStatus] = useState({ msg: 'Ready.', type: '' });
  const [micLevel, setMicLevel] = useState(0);
  const [batLevel, setBatLevel] = useState(0);
  const [running, setRunning] = useState(false);

  const micStreamRef = useRef(null);
  const camStreamRef = useRef(null);
  const micRafRef = useRef(null);
  const videoRef = useRef(null);

  const set = (id, badge, detail, extra = null) =>
    setResults(prev => ({ ...prev, [id]: { badge, detail, extra } }));

  // ── Microphone ──────────────────────────────────────────────────────────
  const checkMicrophone = async () => {
    set('microphone', 'checking', 'Requesting permission…');
    try {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const label = stream.getAudioTracks()[0]?.label || 'Unknown microphone';
      set('microphone', 'ok', label);
      cancelAnimationFrame(micRafRef.current);
      const animate = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setMicLevel(Math.min(100, Math.round(avg * 2.5)));
        micRafRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch (e) {
      if (e.name === 'NotAllowedError') set('microphone', 'denied', 'Allow microphone in browser settings.');
      else if (e.name === 'NotFoundError') set('microphone', 'error', 'No microphone found.');
      else set('microphone', 'error', e.message);
    }
  };

  // ── Webcam ───────────────────────────────────────────────────────────────
  const checkWebcam = async () => {
    set('webcam', 'checking', 'Requesting permission…');
    try {
      if (camStreamRef.current) camStreamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      camStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const s = track.getSettings?.() || {};
      const res = s.width && s.height ? ` — ${s.width}×${s.height}` : '';
      set('webcam', 'ok', (track.label || 'Unknown camera') + res, 'preview');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      if (e.name === 'NotAllowedError') set('webcam', 'denied', 'Allow camera in browser settings.');
      else if (e.name === 'NotFoundError') set('webcam', 'error', 'No webcam found.');
      else set('webcam', 'error', e.message);
    }
  };

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const checkKeyboard = () => {
    set('keyboard', 'ok', 'Press any key to test…');
    const onKey = (e) => {
      const key = e.key === ' ' ? 'Space' : e.key;
      set('keyboard', 'ok', `Last key: ${key} (${e.code})`);
    };
    window.addEventListener('keydown', onKey);
  };

  // ── Mouse ────────────────────────────────────────────────────────────────
  const checkMouse = () => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (fine) {
      set('mouse', 'ok', 'Mouse / trackpad detected.');
      window.addEventListener('mousemove', (e) => {
        set('mouse', 'ok', `Position: ${e.clientX}, ${e.clientY}`);
      });
    } else if (coarse) {
      set('mouse', 'na', 'Touch-only device — no mouse/trackpad.');
    } else {
      set('mouse', 'na', 'No pointer detected.');
    }
  };

  // ── Touchscreen ──────────────────────────────────────────────────────────
  const checkTouch = () => {
    const has = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (has) set('touchscreen', 'ok', `Max touch points: ${navigator.maxTouchPoints}`);
    else set('touchscreen', 'na', 'No touch screen detected.');
  };

  // ── Gamepad ──────────────────────────────────────────────────────────────
  const checkGamepad = () => {
    if (!('getGamepads' in navigator)) {
      set('gamepad', 'na', 'Gamepad API not supported.');
      return;
    }
    const pads = [...navigator.getGamepads()].filter(Boolean);
    if (pads.length > 0) {
      set('gamepad', 'ok', pads.map(p => p.id.split('(')[0].trim()).join(', '));
    } else {
      set('gamepad', 'na', 'No gamepad connected. Press a button to detect.');
      window.addEventListener('gamepadconnected', (e) => {
        set('gamepad', 'ok', e.gamepad.id.split('(')[0].trim());
      });
    }
  };

  // ── Battery ──────────────────────────────────────────────────────────────
  const checkBattery = async () => {
    if (!('getBattery' in navigator)) {
      set('battery', 'na', 'Battery API not supported (likely desktop).');
      return;
    }
    try {
      const batt = await navigator.getBattery();
      const update = () => {
        const pct = Math.round(batt.level * 100);
        setBatLevel(pct);
        set('battery', pct > 15 ? 'ok' : 'error',
          `${pct}% — ${batt.charging ? 'Charging ⚡' : 'On battery'}`);
      };
      update();
      batt.addEventListener('chargingchange', update);
      batt.addEventListener('levelchange', update);
    } catch {
      set('battery', 'na', 'Could not read battery status.');
    }
  };

  // ── Network ──────────────────────────────────────────────────────────────
  const checkNetwork = () => {
    if (!navigator.onLine) { set('network', 'error', 'No connection.'); return; }
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      const type = (conn.effectiveType || conn.type || 'unknown').toUpperCase();
      const down = conn.downlink ? ` · ${conn.downlink} Mbps` : '';
      set('network', 'ok', `${type}${down}`);
    } else {
      set('network', 'ok', 'Online (no detailed info available).');
    }
  };

  // ── Run all ──────────────────────────────────────────────────────────────
  const runAll = async () => {
    setRunning(true);
    setStatus({ msg: 'Checking all devices…', type: '' });
    DEVICES.forEach(d => set(d.id, 'checking', ''));
    await checkMicrophone();
    await checkWebcam();
    checkKeyboard();
    checkMouse();
    checkTouch();
    checkGamepad();
    await checkBattery();
    checkNetwork();
    setStatus({ msg: '✓ All checks complete.', type: 'ok' });
    setRunning(false);
  };

  // Stop streams on unmount
  useEffect(() => () => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(micRafRef.current);
  }, []);

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Input Device Checker</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={runAll} disabled={running}>
            {running ? 'Checking…' : 'Check All'}
          </ActionBtn>
        </div>
      </div>

      <div className="tk-main">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.75rem',
        }}>
          {DEVICES.map(({ id, icon, label }) => {
            const r = results[id];
            return (
              <div
                key={id}
                style={{
                  padding: '0.9rem 1rem',
                  background: 'var(--tk-surface)',
                  border: '1px solid var(--tk-border)',
                  borderRadius: 'var(--tk-radius)',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--tk-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1rem' }}>{icon}</span>
                    {label}
                  </span>
                  <Badge type={r.badge} />
                </div>

                {/* Detail text */}
                <p style={{
                  fontSize: '0.7rem',
                  color: 'var(--tk-text-dim)',
                  margin: 0,
                  minHeight: '1.1rem',
                  fontFamily: id === 'keyboard' || id === 'mouse' ? 'var(--tk-mono)' : undefined,
                }}>
                  {r.detail || '—'}
                </p>

                {/* Mic meter */}
                {id === 'microphone' && r.badge === 'ok' && (
                  <MeterBar value={micLevel} />
                )}

                {/* Battery meter */}
                {id === 'battery' && r.badge !== 'pending' && r.badge !== 'checking' && r.badge !== 'na' && (
                  <MeterBar value={batLevel} />
                )}

                {/* Webcam preview */}
                {id === 'webcam' && r.extra === 'preview' && (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      marginTop: 8,
                      width: '100%',
                      aspectRatio: '16/9',
                      borderRadius: 'var(--tk-radius)',
                      background: '#000',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Info note */}
        <p style={{ fontSize: '0.65rem', color: 'var(--tk-text-dim)', marginTop: '1rem' }}>
          Mic and webcam checks require browser permission prompts. Gamepad: connect and press a button to detect.
          Battery API is unavailable on most desktops.
        </p>
      </div>

      <StatusBar {...status} />
    </div>
  );
}