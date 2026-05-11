import { useState, useRef } from 'react';
import { CopyBtn, ActionBtn, StatusBar } from './tk-shared';

export default function CSVTSVConverter() {
  const [input, setInput] = useState('name,age,city\nJohn,30,NYC\nJane,25,LA');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const [mode, setMode] = useState('csvToJson'); // csvToJson, jsonToCsv, csvToTsv, tsvToCsv
  const outputRef = useRef("");

  const parseCSV = (csv, delimiter = ',') => {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const nextChar = csv[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (currentCell || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(cell => cell)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        }
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentCell += char;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  const csvToJson = (csv) => {
    const rows = parseCSV(csv, ',');
    if (rows.length === 0) throw new Error('No data found');

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });

    return JSON.stringify(data, null, 2);
  };

  const jsonToCsv = (json) => {
    const data = JSON.parse(json);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('JSON must be an array with at least one object');
    }

    const headers = Object.keys(data[0]);
    const rows = [headers.join(',')];

    data.forEach(obj => {
      const row = headers.map(header => {
        const value = obj[header] ?? '';
        const stringValue = String(value);
        return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      });
      rows.push(row.join(','));
    });

    return rows.join('\n');
  };

  const convertFormat = () => {
    try {
      if (!input.trim()) {
        setStatus({ msg: "✗ Please enter data", type: "err" });
        setOutput('');
        return;
      }

      let result = '';

      if (mode === 'csvToJson') {
        result = csvToJson(input);
      } else if (mode === 'jsonToCsv') {
        result = jsonToCsv(input);
      } else if (mode === 'csvToTsv') {
        const rows = parseCSV(input, ',');
        result = rows.map(row => row.join('\t')).join('\n');
      } else if (mode === 'tsvToCsv') {
        const rows = parseCSV(input, '\t');
        result = rows.map(row =>
          row.map(cell =>
            cell.includes(',') || cell.includes('"') || cell.includes('\n')
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          ).join(',')
        ).join('\n');
      }

      setOutput(result);
      outputRef.current = result;
      setStatus({ msg: "✓ Converted successfully", type: "ok" });
    } catch (err) {
      setStatus({ msg: "✗ " + err.message, type: "err" });
      setOutput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      convertFormat();
    }
  };

  const swapInputOutput = () => {
    setInput(output);
    setOutput(input);
    if (mode === 'csvToJson') setMode('jsonToCsv');
    else if (mode === 'jsonToCsv') setMode('csvToJson');
  };

  const examples = {
    csvToJson: 'name,age,city\nJohn,30,NYC\nJane,25,LA',
    jsonToCsv: '[{"name":"John","age":30,"city":"NYC"},{"name":"Jane","age":25,"city":"LA"}]',
    csvToTsv: 'name,age,city\nJohn,30,NYC\nJane,25,LA',
    tsvToCsv: 'name\tage\tcity\nJohn\t30\tNYC\nJane\t25\tLA',
  };

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">CSV/TSV Converter</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={() => outputRef.current} />
          {output && <ActionBtn onClick={swapInputOutput}>Swap</ActionBtn>}
          <ActionBtn danger onClick={() => { setInput(''); setOutput(''); setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
        </div>
      </div>

      <div className="tk-main">
        {/* Mode Selection */}
        <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
          <label className="tk-pane-label">CONVERSION MODE</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
            {[
              { id: 'csvToJson', label: 'CSV → JSON' },
              { id: 'jsonToCsv', label: 'JSON → CSV' },
              { id: 'csvToTsv', label: 'CSV → TSV' },
              { id: 'tsvToCsv', label: 'TSV → CSV' },
            ].map(option => (
              <button
                key={option.id}
                onClick={() => { setMode(option.id); setInput(examples[option.id]); }}
                style={{
                  padding: "0.5rem",
                  background: mode === option.id ? "var(--tk-surface2)" : "var(--tk-surface)",
                  border: `1px solid ${mode === option.id ? "var(--tk-border-bright)" : "var(--tk-border)"}`,
                  borderRadius: "var(--tk-radius)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => e.target.style.borderColor = "var(--tk-border-bright)"}
                onMouseLeave={(e) => e.target.style.borderColor = mode === option.id ? "var(--tk-border-bright)" : "var(--tk-border)"}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
          <label className="tk-pane-label">INPUT</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Paste your CSV, TSV, or JSON data..."
            className="tk-textarea"
            style={{ minHeight: "120px", fontFamily: "var(--tk-mono)" }}
          />
          <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", marginTop: "0.3rem" }}>
            Ctrl+Enter to convert. Supports quoted fields and special characters.
          </p>
        </div>

        <ActionBtn onClick={convertFormat} style={{ width: "100%", marginBottom: "1.5rem" }}>
          Convert
        </ActionBtn>

        {/* Output */}
        {output && (
          <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
            <label className="tk-pane-label">OUTPUT</label>
            <pre
              className="tk-output-pre"
              style={{
                marginTop: "0.5rem",
                maxHeight: "300px",
                overflowY: "auto",
                padding: "1rem",
                background: "var(--tk-surface)",
                borderRadius: "var(--tk-radius)",
                fontSize: "0.75rem",
              }}
            >
              {output}
            </pre>
          </div>
        )}

        <StatusBar status={status} />
      </div>
    </div>
  );
}
