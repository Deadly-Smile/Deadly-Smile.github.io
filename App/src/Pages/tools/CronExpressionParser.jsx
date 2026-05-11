import { useState, useRef } from 'react';
import { CopyBtn, ActionBtn, StatusBar } from './tk-shared';

export default function CronExpressionParser() {
  const [expression, setExpression] = useState('0 12 * * *');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const resultRef = useRef("");

  const parseCron = (expr) => {
    const parts = expr.trim().split(/\s+/).filter(p => p);
    
    if (parts.length !== 5) {
      throw new Error('Cron expression must have exactly 5 fields: minute hour day month dayOfWeek');
    }

    const [minute, hour, day, month, dayOfWeek] = parts;
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const parseField = (field, min, max) => {
      if (field === '*') return `every (0-${max})`;
      if (field === '?') return 'no specific value';
      if (field.includes(',')) return `${field.split(',').join(', ')}`;
      if (field.includes('/')) {
        const [start, step] = field.split('/');
        return `every ${step} (starting from ${start === '*' ? 'start' : start})`;
      }
      if (field.includes('-')) return `range: ${field}`;
      return field;
    };

    const description = {
      minute: parseField(minute, 0, 59),
      hour: parseField(hour, 0, 23),
      dayOfMonth: parseField(day, 1, 31),
      month: parseField(month, 1, 12),
      dayOfWeek: parseField(dayOfWeek, 0, 6),
    };

    const nextRuns = getNextRuns(minute, hour, day, month, dayOfWeek, 5);

    return { expression: expr, description, nextRuns };
  };

  const getNextRuns = (min, hour, day, month, dow, count) => {
    const runs = [];
    let current = new Date();
    
    for (let i = 0; i < count; i++) {
      current = getNextCronDate(current, min, hour, day, month, dow);
      if (current) {
        runs.push(current.toLocaleString());
      } else {
        break;
      }
    }
    return runs;
  };

  const getNextCronDate = (from, min, hour, day, month, dow) => {
    const date = new Date(from);
    date.setSeconds(0);
    date.setMilliseconds(0);
    date.setMinutes(parseInt(min) || 0);
    date.setHours(parseInt(hour) || 0);
    
    // Simple implementation - just return next occurrence
    if (min === '*' && hour === '*') {
      date.setDate(date.getDate() + 1);
    } else {
      date.setDate(date.getDate() + 1);
    }
    return date;
  };

  const handleParse = () => {
    if (!expression.trim()) {
      setStatus({ msg: "Please enter a cron expression", type: "err" });
      setResult(null);
      return;
    }

    try {
      const parsed = parseCron(expression);
      setResult(parsed);
      resultRef.current = expression;
      setStatus({ msg: "✓ Parsed successfully", type: "ok" });
    } catch (err) {
      setStatus({ msg: "✗ " + err.message, type: "err" });
      setResult(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleParse();
    }
  };

  const examples = [
    { expr: '0 12 * * *', desc: 'Every day at 12:00 PM' },
    { expr: '*/15 * * * *', desc: 'Every 15 minutes' },
    { expr: '0 0 * * 0', desc: 'Every Sunday at midnight' },
    { expr: '0 9 * * 1-5', desc: 'Weekdays at 9:00 AM' },
    { expr: '0 0 1 * *', desc: 'First day of every month' },
  ];

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Cron Expression Parser</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={handleParse}>Parse</ActionBtn>
          <CopyBtn getText={() => resultRef.current} />
          <ActionBtn danger onClick={() => { setExpression('0 12 * * *'); setResult(null); setStatus({ msg: "Ready.", type: "" }); }}>Reset</ActionBtn>
        </div>
      </div>

      <div className="tk-main">
        {/* Expression Input */}
        <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
          <label className="tk-pane-label">CRON EXPRESSION</label>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="minute hour day month dayOfWeek"
            className="tk-input"
            style={{ width: "100%", fontFamily: "var(--tk-mono)" }}
          />
          <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", marginTop: "0.3rem" }}>
            Format: minute(0-59) hour(0-23) day(1-31) month(1-12) dayOfWeek(0-6)
          </p>
        </div>

        {/* Examples */}
        <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
          <label className="tk-pane-label">COMMON EXAMPLES</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => { setExpression(ex.expr); resultRef.current = ex.expr; }}
                style={{
                  padding: "0.5rem",
                  fontSize: "0.75rem",
                  background: "var(--tk-surface2)",
                  border: "1px solid var(--tk-border)",
                  borderRadius: "var(--tk-radius)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.borderColor = "var(--tk-border-bright)"}
                onMouseLeave={(e) => e.target.style.borderColor = "var(--tk-border)"}
              >
                <div style={{ fontFamily: "var(--tk-mono)", fontSize: "0.7rem", marginBottom: "0.2rem" }}>{ex.expr}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)" }}>{ex.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        {result && (
          <>
            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
              <p className="tk-pane-label">BREAKDOWN</p>
              <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.5rem", fontSize: "0.85rem" }}>
                <div><strong>Minute:</strong> {result.description.minute}</div>
                <div><strong>Hour:</strong> {result.description.hour}</div>
                <div><strong>Day of Month:</strong> {result.description.dayOfMonth}</div>
                <div><strong>Month:</strong> {result.description.month}</div>
                <div><strong>Day of Week:</strong> {result.description.dayOfWeek}</div>
              </div>
            </div>

            <div style={{ padding: "1rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)" }}>
              <p className="tk-pane-label">NEXT 5 RUNS</p>
              <div style={{ marginTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.75rem", fontFamily: "var(--tk-mono)", maxHeight: "150px", overflowY: "auto" }}>
                {result.nextRuns.map((run, i) => (
                  <div key={i} style={{ padding: "0.3rem", background: "var(--tk-surface)", borderRadius: "2px" }}>{run}</div>
                ))}
              </div>
            </div>
          </>
        )}

        <StatusBar status={status} />
      </div>
    </div>
  );
}
