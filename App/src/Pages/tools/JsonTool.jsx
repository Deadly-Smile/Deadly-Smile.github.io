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

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">JSON Formatter &amp; Validator</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={() => format(2)}>Format</ActionBtn>
          <ActionBtn onClick={() => format(0)}>Minify</ActionBtn>
          <CopyBtn getText={() => outRef.current} />
          <ActionBtn danger onClick={() => { setInput(""); setOutput(""); outRef.current = ""; setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
        </div>
      </div>
      <SplitPane
        left={<><PaneLabel>INPUT</PaneLabel><textarea className="tk-textarea" value={input} onChange={e => setInput(e.target.value)} placeholder="Paste your JSON here..." /></>}
        right={<><PaneLabel>OUTPUT</PaneLabel><pre className="tk-output-pre">{output}</pre></>}
      />
      <StatusBar {...status} />
    </div>
  );
}
