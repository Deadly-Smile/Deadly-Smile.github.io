import { useState, useRef } from "react";
import { CopyBtn, ActionBtn, StatusBar, SplitPane, PaneLabel } from "./tk-shared";

export default function Base64Tool() {
  const [plain, setPlain]   = useState("");
  const [b64,   setB64]     = useState("");
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const b64Ref = useRef("");

  const encode = () => {
    try {
      const r = btoa(unescape(encodeURIComponent(plain)));
      setB64(r); b64Ref.current = r;
      setStatus({ msg: "✓ Encoded", type: "ok" });
    } catch (e) { setStatus({ msg: "✗ " + e.message, type: "err" }); }
  };

  const decode = () => {
    try {
      setPlain(decodeURIComponent(escape(atob(b64.trim()))));
      setStatus({ msg: "✓ Decoded", type: "ok" });
    } catch { setStatus({ msg: "✗ Invalid Base64", type: "err" }); }
  };

  const handlePlain = v => {
    setPlain(v);
    if (!v) { setB64(""); b64Ref.current = ""; return; }
    try {
      const r = btoa(unescape(encodeURIComponent(v)));
      setB64(r); b64Ref.current = r;
      setStatus({ msg: "✓ Live encoding", type: "ok" });
    } catch {}
  };

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Base64 Encoder / Decoder</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={encode}>Encode →</ActionBtn>
          <ActionBtn onClick={decode}>← Decode</ActionBtn>
          <CopyBtn getText={() => b64Ref.current} />
        </div>
      </div>
      <SplitPane
        left={<><PaneLabel>PLAIN TEXT</PaneLabel><textarea className="tk-textarea" value={plain} onChange={e => handlePlain(e.target.value)} placeholder="Type or paste text..." /></>}
        right={<><PaneLabel>BASE64</PaneLabel><textarea className="tk-textarea" value={b64} onChange={e => { setB64(e.target.value); b64Ref.current = e.target.value; }} placeholder="Base64 output..." /></>}
      />
      <StatusBar {...status} />
    </div>
  );
}
