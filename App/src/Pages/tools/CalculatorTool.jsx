import { useState, useRef } from 'react';
import { evaluate } from 'mathjs';
import { CopyBtn, ActionBtn, StatusBar } from './tk-shared';

export default function CalculatorTool() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const [history, setHistory] = useState([]);
  const resultRef = useRef("");

  const calculateResult = () => {
    if (!expression.trim()) {
      setStatus({ msg: "Ready.", type: "" });
      setResult(null);
      return;
    }
    try {
      const calculatedResult = evaluate(expression);
      setResult(calculatedResult);
      resultRef.current = formatResult(calculatedResult);
      setHistory([
        { expression, result: calculatedResult },
        ...history.slice(0, 9)
      ]);
      setStatus({ msg: "✓ Calculated", type: "ok" });
    } catch (err) {
      setResult(null);
      resultRef.current = "";
      setStatus({ msg: "✗ " + err.message, type: "err" });
    }
  };

  const formatResult = (value) => {
    if (typeof value === 'number') {
      return value.toFixed(10).replace(/\.?0+$/, '');
    }
    return String(value);
  };

  const loadFromHistory = (item) => {
    setExpression(item.expression);
    setResult(item.result);
    resultRef.current = formatResult(item.result);
    setStatus({ msg: "✓ Loaded from history", type: "ok" });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      calculateResult();
    }
  };

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Math Calculator</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={calculateResult}>Calculate</ActionBtn>
          <CopyBtn getText={() => resultRef.current} />
          <ActionBtn danger onClick={() => { setExpression(""); setResult(null); setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
        </div>
      </div>

      <div className="tk-main">
        {/* Expression Input */}
        <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
          <label className="tk-pane-label">EXPRESSION</label>
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter math expression (Ctrl+Enter to calculate)..."
            className="tk-textarea"
            style={{ minHeight: "80px", fontFamily: "var(--tk-mono)" }}
          />
          <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", marginTop: "0.3rem" }}>
            Tip: Use Ctrl+Enter to calculate. Supports: +, -, *, /, ^, log, log2, log10, sin, cos, tan, sqrt, abs, pow, etc.
          </p>
        </div>

        {/* Result Display */}
        {result !== null && (
          <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
            <p className="tk-pane-label">RESULT</p>
            <pre className="tk-output-pre" style={{ marginTop: "0.5rem" }}>
              {formatResult(result)}
            </pre>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <label className="tk-pane-label">HISTORY ({history.length})</label>
              <ActionBtn danger onClick={() => setHistory([])}>Clear</ActionBtn>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
              {history.map((item, index) => (
                <div
                  key={index}
                  onClick={() => loadFromHistory(item)}
                  style={{
                    padding: "0.8rem",
                    background: "var(--tk-surface)",
                    border: "1px solid var(--tk-border)",
                    borderRadius: "var(--tk-radius)",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--tk-surface2)";
                    e.currentTarget.style.borderColor = "var(--tk-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--tk-surface)";
                    e.currentTarget.style.borderColor = "var(--tk-border)";
                  }}
                >
                  <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", margin: "0 0 0.3rem 0" }}>{item.expression}</p>
                  <p style={{ fontSize: "0.85rem", color: "var(--tk-accent)", margin: "0", fontWeight: "bold" }}>
                    = {formatResult(item.result)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <StatusBar {...status} />
    </div>
  );
}
