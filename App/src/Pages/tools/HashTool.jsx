import { useState, useEffect, useRef } from "react";
import { CopySmall } from "./tk-shared";
import { sha256Hex, sha1Hex, sha512Hex, md5Hex } from "../../Utils/hash";

export default function HashTool() {
  const [text,   setText]   = useState("");
  const [hashes, setHashes] = useState({ sha256:"—", sha1:"—", sha512:"—", md5:"—" });
  const [isMaximized, setIsMaximized] = useState(false);
  const ref = useRef({ sha256:"—", sha1:"—", sha512:"—", md5:"—" });

  useEffect(() => {
    if (!text) { const e={sha256:"—",sha1:"—",sha512:"—",md5:"—"}; setHashes(e); ref.current=e; return; }
    Promise.all([sha256Hex(text),sha1Hex(text),sha512Hex(text)])
      .then(([s256,s1,s512]) => {
        const r={sha256:s256,sha1:s1,sha512:s512,md5:md5Hex(text)};
        setHashes(r); ref.current=r;
      });
  }, [text]);

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
        <h2 className="tk-tool-title">Hash Generator</h2>
        <button
          onClick={() => setIsMaximized(!isMaximized)}
          className="tk-editor-max-btn"
          title={isMaximized ? "Exit fullscreen" : "Fullscreen editor"}
        >
          {isMaximized ? "✕" : "⊞"}
        </button>
      </div>
      <div className="tk-pane" style={{marginBottom:"1rem"}}>
        <div className="tk-pane-label">INPUT</div>
        <textarea className={`tk-textarea ${isMaximized ? "tk-textarea-maximized" : ""}`} value={text} onChange={e=>setText(e.target.value)} placeholder="Enter text to hash..." />
      </div>
      {!isMaximized && (
        <>
          <div className="tk-hash-results">
            {[{label:"SHA-256",key:"sha256"},{label:"SHA-1",key:"sha1"},{label:"SHA-512",key:"sha512"},{label:"MD5*",key:"md5"}].map(row=>(
              <div key={row.key} className="tk-hash-row">
                <span className="tk-hash-algo">{row.label}</span>
                <code>{hashes[row.key]}</code>
                <CopySmall getText={()=>ref.current[row.key]} />
              </div>
            ))}
          </div>
          <div className="tk-status-bar" style={{marginTop:"0.8rem"}}>*MD5 via pure-JS. Use SHA for security.</div>
        </>
      )}
    </div>
  );
}
