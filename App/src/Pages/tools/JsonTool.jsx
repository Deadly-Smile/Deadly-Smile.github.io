import { useState, useEffect, useCallback, useRef } from "react";
import { CopyBtn, ActionBtn, StatusBar, SplitPane, PaneLabel } from "./tk-shared";

function countKeys(obj, n = 0) {
  if (typeof obj !== "object" || obj === null) return n;
  const keys = Object.keys(obj);
  n += keys.length;
  keys.forEach(k => { n = countKeys(obj[k], n); });
  return n;
}

export default function JsonTool() {
  const [input,  setInput]  = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const [isMaximized, setIsMaximized] = useState(false);
  const outRef = useRef("");

  const format = useCallback((indent, raw = input) => {
    if (!raw.trim()) { setOutput(""); outRef.current = ""; setStatus({ msg: "Ready.", type: "" }); return; }
    try {
      const p = JSON.parse(raw);
      const r = JSON.stringify(p, null, indent);
      setOutput(r); outRef.current = r;
      setStatus({ msg: `✓ Valid JSON — ${countKeys(p)} keys/values`, type: "ok" });
    } catch (e) {
      setOutput(""); outRef.current = "";
      setStatus({ msg: "✗ " + e.message, type: "err" });
    }
  }, [input]);

  useEffect(() => { format(2, input); }, [input]);

  // Handle Escape key to exit maximize
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  return (
    <div className={`tk-editor-container ${isMaximized ? "tk-editor-maximized" : ""}`}>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">JSON Formatter &amp; Validator</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={() => format(2)}>Format</ActionBtn>
          <ActionBtn onClick={() => format(0)}>Minify</ActionBtn>
          <CopyBtn getText={() => outRef.current} />
          <ActionBtn danger onClick={() => { setInput(""); setOutput(""); outRef.current = ""; setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="tk-editor-max-btn"
            title={isMaximized ? "Exit fullscreen" : "Fullscreen editor"}
          >
            {isMaximized ? "✕" : "⊞"}
          </button>
        </div>
      </div>
      <div className={`tk-split-pane-wrapper ${isMaximized ? "tk-editor-input-max" : ""}`}>
        <SplitPane
          left={<><PaneLabel>INPUT</PaneLabel><textarea className="tk-textarea" value={input} onChange={e => setInput(e.target.value)} placeholder="Paste your JSON here..." /></>}
          right={isMaximized ? null : <><PaneLabel>OUTPUT</PaneLabel><pre className="tk-output-pre">{output}</pre></>}
        />
      </div>
      {!isMaximized && <StatusBar {...status} />}
    </div>
  );
}
