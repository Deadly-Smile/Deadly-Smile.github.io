import { useState, useMemo, useRef, useEffect } from "react";
import { CopyBtn } from "./tk-shared";

export default function HtmlPreviewerTool() {
  const [html, setHtml] = useState(`<div class="container">
  <h1>Hello World</h1>
  <p>Edit the panels on the left to see changes in real-time</p>
</div>`);
  
  const [css, setCss] = useState(`* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.container {
  padding: 2rem;
  text-align: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

h1 {
  font-size: 3rem;
  margin: 0;
  margin-bottom: 1rem;
  color: #333;
}

p {
  font-size: 1.2rem;
  color: #666;
  max-width: 600px;
}`);
  
  const [js, setJs] = useState(`console.log('HTML Previewer loaded!');

// Add interactivity here
document.addEventListener('DOMContentLoaded', () => {
  console.log('Document ready');
});`);

  const [refreshKey, setRefreshKey] = useState(0);
  const [logs, setLogs] = useState([]);
  const [cssOpen, setCssOpen] = useState(true);
  const [jsOpen, setJsOpen] = useState(true);
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === "console") {
        setLogs(prev => [...prev, event.data.message]);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const clearLogs = () => setLogs([]);

  const iframeContent = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Preview</title>
  <style>
${css}
  </style>
</head>
<body>
${html}
  <script>
(function() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  function sendLog(level, args) {
    const message = Array.from(args)
      .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
      .join(' ');
    window.parent.postMessage({
      type: 'console',
      message: { level, text: message }
    }, '*');
  }

  console.log = function(...args) {
    originalLog.apply(console, args);
    sendLog('log', args);
  };
  console.error = function(...args) {
    originalError.apply(console, args);
    sendLog('error', args);
  };
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    sendLog('warn', args);
  };
})();

${js}
  </script>
</body>
</html>`;
  }, [html, css, js]);

  const getFullCode = () => iframeContent;

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">HTML Previewer</h2>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CopyBtn getText={() => html} label="Copy HTML" />
        <CopyBtn getText={() => css} label="Copy CSS" />
        <CopyBtn getText={() => js} label="Copy JS" />
        <CopyBtn getText={getFullCode} label="Copy All" />
        <button 
          className="tk-action-btn"
          onClick={() => setRefreshKey(k => k + 1)}
          title="Refresh preview"
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", minHeight: "600px" }}>
        {/* Code Editors */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
          {/* HTML */}
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#aaa", marginBottom: "0.5rem", letterSpacing: "0.05em" }}>
              HTML
            </div>
            <textarea
              value={html}
              onChange={(e) => { setHtml(e.target.value); setLogs([]); }}
              style={{
                width: "100%",
                height: "180px",
                padding: "0.8rem",
                fontFamily: "'Space Mono', monospace",
                fontSize: "0.85rem",
                background: "#0d0d0d",
                color: "#e8e8e8",
                border: "1px solid #333",
                borderRadius: "4px",
                resize: "none",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#667eea")}
              onBlur={(e) => (e.target.style.borderColor = "#333")}
            />
          </div>

          {/* CSS - Collapsible */}
          <div>
            <button
              onClick={() => setCssOpen(!cssOpen)}
              style={{
                width: "100%",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#aaa",
                background: "none",
                border: "none",
                padding: "0.5rem 0",
                cursor: "pointer",
                textAlign: "left",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ display: "inline-block", transition: "transform 0.2s", transform: cssOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                ▶
              </span>
              CSS
            </button>
            {cssOpen && (
              <textarea
                value={css}
                onChange={(e) => { setCss(e.target.value); setLogs([]); }}
                style={{
                  width: "100%",
                  height: "180px",
                  padding: "0.8rem",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.85rem",
                  background: "#0d0d0d",
                  color: "#e8e8e8",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  resize: "none",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#667eea")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
              />
            )}
          </div>

          {/* JavaScript - Collapsible */}
          <div>
            <button
              onClick={() => setJsOpen(!jsOpen)}
              style={{
                width: "100%",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#aaa",
                background: "none",
                border: "none",
                padding: "0.5rem 0",
                cursor: "pointer",
                textAlign: "left",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ display: "inline-block", transition: "transform 0.2s", transform: jsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                ▶
              </span>
              JAVASCRIPT
            </button>
            {jsOpen && (
              <textarea
                value={js}
                onChange={(e) => { setJs(e.target.value); setLogs([]); }}
                style={{
                  width: "100%",
                  height: "180px",
                  padding: "0.8rem",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.85rem",
                  background: "#0d0d0d",
                  color: "#e8e8e8",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  resize: "none",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#667eea")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
              />
            )}
          </div>
        </div>

        {/* Preview & Console */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Preview */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#aaa", marginBottom: "0.5rem", letterSpacing: "0.05em" }}>
              PREVIEW
            </div>
            <iframe
              ref={iframeRef}
              key={refreshKey}
              srcDoc={iframeContent}
              style={{
                flex: 1,
                width: "100%",
                minHeight: "250px",
                border: "1px solid #333",
                borderRadius: "4px",
                background: "white",
              }}
              sandbox="allow-scripts"
              title="HTML Preview"
            />
          </div>

          {/* Console Terminal */}
          <div style={{ display: "flex", flexDirection: "column", maxHeight: "200px" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#aaa", marginBottom: "0.5rem", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>CONSOLE</span>
              <button
                onClick={clearLogs}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid #555",
                  color: "#aaa",
                  cursor: "pointer",
                  borderRadius: "2px",
                }}
              >
                Clear
              </button>
            </div>
            <div
              style={{
                flex: 1,
                width: "100%",
                padding: "0.8rem",
                fontFamily: "'Space Mono', monospace",
                fontSize: "0.8rem",
                background: "#0d0d0d",
                color: "#e8e8e8",
                border: "1px solid #333",
                borderRadius: "4px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {logs.length === 0 ? (
                <span style={{ color: "#666" }}>No logs yet...</span>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} style={{ color: log.level === "error" ? "#ff6b6b" : log.level === "warn" ? "#ffd93d" : "#e8e8e8" }}>
                    {log.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
