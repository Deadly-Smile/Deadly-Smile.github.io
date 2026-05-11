import { useState, useRef } from 'react';
import { CopyBtn, ActionBtn, StatusBar } from './tk-shared';

export default function TimestampConverter() {
  const [timestamp, setTimestamp] = useState(Math.floor(Date.now() / 1000));
  const [humanDate, setHumanDate] = useState(new Date().toISOString());
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const resultRef = useRef("");
  const [activeTab, setActiveTab] = useState('unixToHuman');

  const convertUnixToHuman = (ts) => {
    const isMillis = ts > 10000000000;
    const date = new Date(isMillis ? ts : ts * 1000);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid timestamp');
    }

    return {
      timestamp: ts,
      isMilliseconds: isMillis,
      iso: date.toISOString(),
      local: date.toLocaleString(),
      localeDate: date.toLocaleDateString(),
      localeTime: date.toLocaleTimeString(),
      utcString: date.toUTCString(),
      dateObj: date,
    };
  };

  const convertHumanToUnix = (dateStr) => {
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }

    const unix = Math.floor(date.getTime() / 1000);
    const unixMs = date.getTime();

    return {
      dateString: dateStr,
      unix,
      unixMs,
      iso: date.toISOString(),
      local: date.toLocaleString(),
      dateObj: date,
    };
  };

  const handleConvertUnixToHuman = () => {
    try {
      const ts = parseInt(timestamp);
      if (isNaN(ts)) {
        setStatus({ msg: "✗ Invalid timestamp", type: "err" });
        setResult(null);
        return;
      }
      const converted = convertUnixToHuman(ts);
      setResult({ type: 'unixToHuman', ...converted });
      resultRef.current = converted.iso;
      setStatus({ msg: "✓ Converted", type: "ok" });
    } catch (err) {
      setStatus({ msg: "✗ " + err.message, type: "err" });
      setResult(null);
    }
  };

  const handleConvertHumanToUnix = () => {
    try {
      if (!humanDate.trim()) {
        setStatus({ msg: "✗ Please enter a date", type: "err" });
        setResult(null);
        return;
      }
      const converted = convertHumanToUnix(humanDate);
      setResult({ type: 'humanToUnix', ...converted });
      resultRef.current = converted.unix.toString();
      setStatus({ msg: "✓ Converted", type: "ok" });
    } catch (err) {
      setStatus({ msg: "✗ " + err.message, type: "err" });
      setResult(null);
    }
  };

  const handleNow = () => {
    const now = Math.floor(Date.now() / 1000);
    setTimestamp(now);
    const converted = convertUnixToHuman(now);
    setResult({ type: 'unixToHuman', ...converted });
    resultRef.current = converted.iso;
    setStatus({ msg: "✓ Set to now", type: "ok" });
  };

  const handleNowDate = () => {
    const now = new Date().toISOString();
    setHumanDate(now);
    const converted = convertHumanToUnix(now);
    setResult({ type: 'humanToUnix', ...converted });
    resultRef.current = converted.unix.toString();
    setStatus({ msg: "✓ Set to now", type: "ok" });
  };

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Timestamp Converter</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={() => resultRef.current} />
          <ActionBtn danger onClick={() => { setResult(null); setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
        </div>
      </div>

      <div className="tk-main">
        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--tk-border)" }}>
          <button
            onClick={() => setActiveTab('unixToHuman')}
            style={{
              padding: "0.5rem 1rem",
              background: activeTab === 'unixToHuman' ? "var(--tk-surface2)" : "transparent",
              border: "none",
              borderBottom: activeTab === 'unixToHuman' ? "2px solid var(--tk-accent)" : "none",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: activeTab === 'unixToHuman' ? "var(--tk-text)" : "var(--tk-text-dim)",
            }}
          >
            Unix → Human
          </button>
          <button
            onClick={() => setActiveTab('humanToUnix')}
            style={{
              padding: "0.5rem 1rem",
              background: activeTab === 'humanToUnix' ? "var(--tk-surface2)" : "transparent",
              border: "none",
              borderBottom: activeTab === 'humanToUnix' ? "2px solid var(--tk-accent)" : "none",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: activeTab === 'humanToUnix' ? "var(--tk-text)" : "var(--tk-text-dim)",
            }}
          >
            Human → Unix
          </button>
        </div>

        {/* Unix to Human */}
        {activeTab === 'unixToHuman' && (
          <>
            <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
              <label className="tk-pane-label">UNIX TIMESTAMP (seconds or milliseconds)</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="number"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  placeholder="Enter Unix timestamp"
                  className="tk-input"
                  style={{ flex: 1, fontFamily: "var(--tk-mono)" }}
                />
                <ActionBtn onClick={handleNow}>Now</ActionBtn>
              </div>
              <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", marginTop: "0.3rem" }}>
                Accepts seconds (e.g., 1672531200) or milliseconds (e.g., 1672531200000)
              </p>
            </div>

            <ActionBtn onClick={handleConvertUnixToHuman} style={{ width: "100%", marginBottom: "1.5rem" }}>
              Convert
            </ActionBtn>

            {result && result.type === 'unixToHuman' && (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
                  <p className="tk-pane-label">ISO 8601</p>
                  <pre className="tk-output-pre" style={{ marginTop: "0.5rem" }}>{result.iso}</pre>
                </div>
                <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
                  <p className="tk-pane-label">LOCAL TIME</p>
                  <pre className="tk-output-pre" style={{ marginTop: "0.5rem" }}>{result.local}</pre>
                </div>
                <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
                  <p className="tk-pane-label">UTC STRING</p>
                  <pre className="tk-output-pre" style={{ marginTop: "0.5rem" }}>{result.utcString}</pre>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border)", borderRadius: "var(--tk-radius)" }}>
                    <p className="tk-pane-label">DATE</p>
                    <pre className="tk-output-pre" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>{result.localeDate}</pre>
                  </div>
                  <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border)", borderRadius: "var(--tk-radius)" }}>
                    <p className="tk-pane-label">TIME</p>
                    <pre className="tk-output-pre" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>{result.localeTime}</pre>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Human to Unix */}
        {activeTab === 'humanToUnix' && (
          <>
            <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
              <label className="tk-pane-label">HUMAN READABLE DATE</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="datetime-local"
                  value={humanDate.slice(0, 16)}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setHumanDate(date.toISOString());
                  }}
                  className="tk-input"
                  style={{ flex: 1 }}
                />
                <ActionBtn onClick={handleNowDate}>Now</ActionBtn>
              </div>
              <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", marginTop: "0.3rem" }}>
                Or paste any date format: "2024-01-15", "Jan 15 2024", "15/01/2024", etc.
              </p>
              <textarea
                value={humanDate}
                onChange={(e) => setHumanDate(e.target.value)}
                placeholder="Paste any date format here..."
                className="tk-textarea"
                style={{ marginTop: "0.5rem", minHeight: "60px", fontFamily: "var(--tk-mono)" }}
              />
            </div>

            <ActionBtn onClick={handleConvertHumanToUnix} style={{ width: "100%", marginBottom: "1.5rem" }}>
              Convert
            </ActionBtn>

            {result && result.type === 'humanToUnix' && (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
                  <p className="tk-pane-label">UNIX (Seconds)</p>
                  <pre className="tk-output-pre" style={{ marginTop: "0.5rem" }}>{result.unix}</pre>
                </div>
                <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
                  <p className="tk-pane-label">UNIX (Milliseconds)</p>
                  <pre className="tk-output-pre" style={{ marginTop: "0.5rem" }}>{result.unixMs}</pre>
                </div>
                <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
                  <p className="tk-pane-label">ISO 8601</p>
                  <pre className="tk-output-pre" style={{ marginTop: "0.5rem" }}>{result.iso}</pre>
                </div>
              </div>
            )}
          </>
        )}

        <StatusBar status={status} />
      </div>
    </div>
  );
}
