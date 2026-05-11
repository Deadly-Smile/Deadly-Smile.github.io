import { useState, useRef, useEffect } from 'react';
import { CopyBtn, ActionBtn, StatusBar } from './tk-shared';

// Common short, readable English words grouped by category for variety
const ADJECTIVES = [
  'amber','brave','calm','dark','eager','fair','glad','huge','idle','just',
  'keen','lazy','mild','neat','odd','pale','quick','rare','safe','tall',
  'vast','warm','wild','young','zesty','bold','cool','deep','epic','firm',
  'gold','hard','kind','long','many','nice','open','pure','real','slim',
  'soft','sure','thin','true','vast','wide','wise','wry','blue','gray',
];

const NOUNS = [
  'apple','bird','cave','dawn','echo','flame','gate','hill','iron','jade',
  'kite','lake','moon','nest','oak','pine','quiz','reef','sage','tide',
  'user','vine','wave','yard','zinc','art','bay','cod','dew','elm',
  'fog','gem','hay','ice','jar','key','log','map','net','orb',
  'pen','rag','rod','sky','sun','tea','tin','top','urn','web',
];

const VERBS = [
  'bake','call','dare','edit','fade','glow','halt','jump','kick','lift',
  'move','note','open','pack','quit','read','send','take','undo','view',
  'walk','xray','yell','zoom','ask','bit','cut','dig','end','fly',
  'get','hit','ink','jot','knit','link','mix','nap','opt','pay',
  'run','set','sit','tap','use','win','wax','fix','aim','act',
];

const NUMBERS = ['0','1','2','3','4','5','6','7','8','9'];
const SYMBOLS = ['!','@','#','$','%','&','*','-','+','=','?'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// ─── Password generators ──────────────────────────────────────────────────────
function generateWordOnlyPassword(wordCount, separator) {
  const pools = [ADJECTIVES, NOUNS, VERBS];
  const words = Array.from({ length: wordCount }, (_, i) => pick(pools[i % pools.length]));
  return words.join(separator);
}

function generateMemorablePassword(wordCount, separator, addNumber, addSymbol) {
  const pools = [ADJECTIVES, NOUNS, VERBS];
  const words = Array.from({ length: wordCount }, (_, i) => capitalize(pick(pools[i % pools.length])));
  let pwd = words.join(separator);
  if (addNumber) pwd += pick(NUMBERS) + pick(NUMBERS);
  if (addSymbol) pwd += pick(SYMBOLS);
  return pwd;
}

function generateCharPassword(length, useUppercase, useLowercase, useNumbers, useSymbols) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums  = '0123456789';
  const syms  = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let chars = '';
  const required = [];

  if (useLowercase) { chars += lower;  required.push(pick([...lower])); }
  if (useUppercase) { chars += upper;  required.push(pick([...upper])); }
  if (useNumbers)   { chars += nums;   required.push(pick([...nums]));  }
  if (useSymbols)   { chars += syms;   required.push(pick([...syms]));  }

  if (!chars) return null;

  let arr = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]);
  required.forEach(ch => { arr[Math.floor(Math.random() * arr.length)] = ch; });
  return arr.join('');
}

// ─── Strength scorer ──────────────────────────────────────────────────────────
function scorePassword(pwd) {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 2;

  const levels = [
    { min: 0, level: 'Weak',      color: '#d32f2f' },
    { min: 3, level: 'Fair',      color: '#f57c00' },
    { min: 5, level: 'Good',      color: '#fbc02d' },
    { min: 7, level: 'Strong',    color: '#689f38' },
    { min: 9, level: 'Very Strong', color: '#388e3c' },
  ];
  const found = [...levels].reverse().find(l => score >= l.min) || levels[0];
  return { score, ...found };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PasswordGenerator() {
  // Mode: 'char' | 'memorable' | 'wordOnly'
  const [mode, setMode] = useState('char');

  // Char mode
  const [length, setLength]           = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers]   = useState(true);
  const [useSymbols, setUseSymbols]   = useState(true);

  // Memorable / word-only shared
  const [wordCount, setWordCount]     = useState(3);
  const [separator, setSeparator]     = useState('-');

  // Memorable extras
  const [addNumber, setAddNumber]     = useState(true);
  const [addSymbol, setAddSymbol]     = useState(true);

  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState(null);
  const [status, setStatus]     = useState({ msg: 'Ready.', type: '' });
  const passwordRef = useRef('');

  const generate = () => {
    let pwd = null;

    if (mode === 'char') {
      if (!useUppercase && !useLowercase && !useNumbers && !useSymbols) {
        setStatus({ msg: '✗ Select at least one character type', type: 'err' });
        return;
      }
      if (length < 4) {
        setStatus({ msg: '✗ Minimum length is 4', type: 'err' });
        return;
      }
      pwd = generateCharPassword(length, useUppercase, useLowercase, useNumbers, useSymbols);
    } else if (mode === 'memorable') {
      pwd = generateMemorablePassword(wordCount, separator, addNumber, addSymbol);
    } else {
      pwd = generateWordOnlyPassword(wordCount, separator);
    }

    if (!pwd) { setStatus({ msg: '✗ Could not generate', type: 'err' }); return; }

    setPassword(pwd);
    passwordRef.current = pwd;
    setStrength(scorePassword(pwd));
    setStatus({ msg: '✓ Password generated', type: 'ok' });
  };

  const clear = () => {
    setPassword('');
    setStrength(null);
    passwordRef.current = '';
    setStatus({ msg: 'Ready.', type: '' });
  };

  const SEPARATORS = [
    { label: 'Hyphen  -',  value: '-' },
    { label: 'Dot  .',     value: '.' },
    { label: 'Space',      value: ' ' },
    { label: 'None',       value: '' },
    { label: 'Underscore _', value: '_' },
  ];

  const modeTab = (id, label) => (
    <button
      onClick={() => { setMode(id); clear(); }}
      style={{
        flex: 1,
        padding: '0.5rem',
        background: mode === id ? 'var(--tk-surface-active, var(--tk-border-bright))' : 'transparent',
        border: `1px solid ${mode === id ? 'var(--tk-border-bright)' : 'var(--tk-border)'}`,
        borderRadius: 'var(--tk-radius)',
        color: mode === id ? 'var(--tk-text)' : 'var(--tk-text-dim)',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: mode === id ? 700 : 400,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Password Generator</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={() => passwordRef.current} />
          <ActionBtn onClick={generate}>Generate</ActionBtn>
          <ActionBtn danger onClick={clear}>Clear</ActionBtn>
        </div>
      </div>

      <div className="tk-main">

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {modeTab('char',      '🔑 Characters')}
          {modeTab('memorable', '🧠 Memorable')}
          {modeTab('wordOnly',  '📖 Words Only')}
        </div>

        {/* ── Character mode ── */}
        {mode === 'char' && (
          <>
            <div className="tk-pane" style={{ marginBottom: '1.5rem' }}>
              <label className="tk-pane-label">PASSWORD LENGTH: {length}</label>
              <input
                type="range" min="4" max="128" value={length}
                onChange={e => setLength(+e.target.value)}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
              <div style={{ display: 'flex', fontSize: '0.7rem', color: 'var(--tk-text-dim)', marginTop: '0.3rem' }}>
                <span>Short</span><span style={{ flex: 1 }} /><span>Long</span>
              </div>
            </div>

            <div className="tk-pane" style={{ marginBottom: '1.5rem' }}>
              <label className="tk-pane-label">CHARACTER TYPES</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.8rem' }}>
                {[
                  { label: 'Uppercase (A-Z)',  state: useUppercase, set: setUseUppercase },
                  { label: 'Lowercase (a-z)',  state: useLowercase, set: setUseLowercase },
                  { label: 'Numbers (0-9)',     state: useNumbers,   set: setUseNumbers   },
                  { label: 'Symbols (!@#$...)', state: useSymbols,   set: setUseSymbols   },
                ].map(({ label, state, set }) => (
                  <label key={label} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                    padding: '0.5rem', borderRadius: 'var(--tk-radius)',
                    background: state ? 'var(--tk-surface)' : 'transparent',
                    border: `1px solid ${state ? 'var(--tk-border-bright)' : 'transparent'}`,
                    transition: 'all 0.2s',
                  }}>
                    <input type="checkbox" checked={state} onChange={() => set(!state)} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.8rem' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Memorable mode ── */}
        {mode === 'memorable' && (
          <div className="tk-pane" style={{ marginBottom: '1.5rem' }}>
            <label className="tk-pane-label">MEMORABLE WORD PASSWORD</label>
            <p style={{ fontSize: '0.7rem', color: 'var(--tk-text-dim)', margin: '0.4rem 0 1rem' }}>
              Combines capitalized words with optional numbers &amp; symbols — easy to say, hard to crack.
            </p>

            <WordOptions
              wordCount={wordCount} setWordCount={setWordCount}
              separator={separator} setSeparator={setSeparator}
              separators={SEPARATORS}
            />

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <CheckOption label="Append numbers" checked={addNumber} onChange={() => setAddNumber(v => !v)} />
              <CheckOption label="Append symbol"  checked={addSymbol} onChange={() => setAddSymbol(v => !v)}  />
            </div>
          </div>
        )}

        {/* ── Words Only mode ── */}
        {mode === 'wordOnly' && (
          <div className="tk-pane" style={{ marginBottom: '1.5rem' }}>
            <label className="tk-pane-label">WORDS ONLY PASSWORD</label>
            <p style={{ fontSize: '0.7rem', color: 'var(--tk-text-dim)', margin: '0.4rem 0 1rem' }}>
              Pure word passphrase — maximum readability, great for typed passwords.
            </p>
            <WordOptions
              wordCount={wordCount} setWordCount={setWordCount}
              separator={separator} setSeparator={setSeparator}
              separators={SEPARATORS}
            />
          </div>
        )}

        {/* ── Output ── */}
        {password && (
          <div style={{
            marginBottom: '1.5rem', padding: '1rem',
            background: 'var(--tk-surface2)',
            border: '1px solid var(--tk-border-bright)',
            borderRadius: 'var(--tk-radius)',
          }}>
            <label className="tk-pane-label">GENERATED PASSWORD</label>
            <pre className="tk-output-pre" style={{
              marginTop: '0.5rem', padding: '0.8rem',
              background: 'var(--tk-surface)', borderRadius: 'var(--tk-radius)',
              wordBreak: 'break-all', fontSize: '1rem', letterSpacing: '0.05em',
              whiteSpace: 'pre-wrap',
            }}>
              {password}
            </pre>

            {strength && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.8rem' }}>Strength:</span>
                  <span style={{ fontSize: '0.8rem', color: strength.color, fontWeight: 'bold' }}>
                    {strength.level}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.1rem', height: '6px', borderRadius: '2px', overflow: 'hidden', background: 'var(--tk-surface)' }}>
                  {[...Array(9)].map((_, i) => (
                    <div key={i} style={{
                      flex: 1, transition: 'all 0.3s',
                      background: i < strength.score ? strength.color : 'var(--tk-border)',
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div style={{
          padding: '0.8rem', background: 'var(--tk-surface2)',
          borderRadius: 'var(--tk-radius)', border: '1px solid var(--tk-border)',
          fontSize: '0.75rem', color: 'var(--tk-text-dim)',
        }}>
          <strong style={{ color: 'var(--tk-text)' }}>💡 Tips:</strong>
          <ul style={{ margin: '0.3rem 0 0 1rem', paddingLeft: 0 }}>
            {mode === 'char' && <>
              <li>12+ characters recommended; 16+ for sensitive accounts</li>
              <li>Mix all four types for maximum entropy</li>
            </>}
            {mode === 'memorable' && <>
              <li>3 words + numbers gives ~40-bit entropy — solid for most uses</li>
              <li>Use 4–5 words for higher security without losing memorability</li>
            </>}
            {mode === 'wordOnly' && <>
              <li>4+ words are as strong as a random 10-char password</li>
              <li>Great for typing on phone or sharing verbally</li>
            </>}
            <li>Never reuse passwords across sites</li>
          </ul>
        </div>

        <StatusBar status={status} />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function WordOptions({ wordCount, setWordCount, separator, setSeparator, separators }) {
  return (
    <>
      <div style={{ marginBottom: '0.8rem' }}>
        <label className="tk-pane-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
          WORD COUNT: {wordCount}
        </label>
        <input
          type="range" min="2" max="6" value={wordCount}
          onChange={e => setWordCount(+e.target.value)}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', fontSize: '0.7rem', color: 'var(--tk-text-dim)', marginTop: '0.2rem' }}>
          <span>2 words</span><span style={{ flex: 1 }} /><span>6 words</span>
        </div>
      </div>

      <div>
        <label className="tk-pane-label" style={{ marginBottom: '0.5rem', display: 'block' }}>SEPARATOR</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {separators.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setSeparator(value)}
              style={{
                padding: '0.3rem 0.6rem', fontSize: '0.75rem',
                borderRadius: 'var(--tk-radius)',
                background: separator === value ? 'var(--tk-border-bright)' : 'var(--tk-surface)',
                border: `1px solid ${separator === value ? 'var(--tk-border-bright)' : 'var(--tk-border)'}`,
                color: separator === value ? 'var(--tk-text)' : 'var(--tk-text-dim)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function CheckOption({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ cursor: 'pointer' }} />
      {label}
    </label>
  );
}