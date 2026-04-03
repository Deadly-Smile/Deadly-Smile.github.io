import { useState, useEffect, useCallback } from "react";
import { ActionBtn, StatusBar, SplitPane, PaneLabel } from "./tk-shared";

export default function RegexTool() {
  const [pattern, setPattern] = useState("");
  const [flags,   setFlags]   = useState("g");
  const [testStr, setTestStr] = useState("");
  const [output,  setOutput]  = useState([]);
  const [status,  setStatus]  = useState({ msg: "Ready.", type: "" });
  const [isMaximized, setIsMaximized] = useState(false);

  const run = useCallback(() => {
    if (!pattern) { setOutput([]); setStatus({ msg: "Enter a pattern.", type: "" }); return; }
    try {
      const f = flags.includes("g") ? flags : flags + "g";
      const re = new RegExp(pattern, f);
      const matches = [...testStr.matchAll(re)];
      if (!matches.length) {
        setOutput([{ type: "none", text: "No matches found." }]);
        setStatus({ msg: "No matches.", type: "err" });
      } else {
        const lines = [`Found ${matches.length} match${matches.length !== 1 ? "es" : ""}:\n`];
        matches.forEach((m, i) => {
          lines.push(`[${i+1}] "${m[0]}" at index ${m.index}`);
          if (m.length > 1) m.slice(1).forEach((g, gi) => lines.push(`     Group ${gi+1}: "${g}"`));
        });
        setOutput(lines.map(t => ({ type: "text", text: t })));
        setStatus({ msg: `✓ ${matches.length} match(es) found`, type: "ok" });
      }
    } catch (e) {
      setOutput([{ type: "err", text: "Invalid regex: " + e.message }]);
      setStatus({ msg: "✗ " + e.message, type: "err" });
    }
  }, [pattern, flags, testStr]);

  useEffect(() => { run(); }, [run]);

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
        <h2 className="tk-tool-title">Regex Tester</h2>
        <div>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="tk-editor-max-btn"
            title={isMaximized ? "Exit fullscreen" : "Fullscreen editor"}
          >
            {isMaximized ? "✕" : "⊞"}
          </button>
        </div>
      </div>
      <div className="tk-regex-top">
        <div className="tk-regex-field-wrap">
          <span className="tk-regex-slash">/</span>
          <input className="tk-regex-input" value={pattern} onChange={e => setPattern(e.target.value)} placeholder="your pattern" />
          <span className="tk-regex-slash">/</span>
          <input className="tk-regex-flags" value={flags} onChange={e => setFlags(e.target.value)} placeholder="gim" maxLength={5} />
        </div>
        <ActionBtn onClick={run}>Test</ActionBtn>
      </div>
      <div className={`tk-split-pane-wrapper ${isMaximized ? "tk-editor-input-max" : ""}`}>
        <SplitPane
          left={<><PaneLabel>TEST STRING</PaneLabel><textarea className="tk-textarea" value={testStr} onChange={e => setTestStr(e.target.value)} placeholder="Type your test string here..." /></>}
          right={isMaximized ? null : <><PaneLabel>MATCHES</PaneLabel><pre className="tk-output-pre">{output.map((o, i) => <span key={i} className={o.type === "err" ? "tk-regex-no-match" : ""}>{o.text + "\n"}</span>)}</pre></>}
        />
      </div>
      {!isMaximized && <StatusBar {...status} />}
    </div>
  );
}
