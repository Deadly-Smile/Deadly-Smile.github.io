import { useState, useEffect, useRef } from "react";
import { CopyBtn, ActionBtn, StatusBar, SplitPane, PaneLabel } from "./tk-shared";

function decodeJWT(token) {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) {
      return { error: "Invalid JWT format. Must have 3 parts (header.payload.signature)" };
    }

    const decode = (str) => {
      let output = str.replace(/-/g, "+").replace(/_/g, "/");
      switch (output.length % 4) {
        case 0: break;
        case 2: output += "=="; break;
        case 3: output += "="; break;
        default: throw new Error("Invalid base64 string");
      }
      return JSON.parse(decodeURIComponent(escape(atob(output))));
    };

    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    const signature = parts[2];

    // Check expiration
    let expiresIn = null;
    let isExpired = false;
    if (payload.exp) {
      const expTime = payload.exp * 1000;
      isExpired = expTime < Date.now();
      expiresIn = new Date(expTime).toLocaleString();
    }

    return {
      header,
      payload,
      signature,
      expiresIn,
      isExpired,
      valid: true
    };
  } catch (e) {
    return { error: "Failed to decode JWT: " + e.message };
  }
}

export default function JWTTool() {
  const [token, setToken] = useState("");
  const [decoded, setDecoded] = useState("");
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const [isMaximized, setIsMaximized] = useState(false);
  const outputRef = useRef("");

  useEffect(() => {
    if (!token.trim()) {
      setDecoded("");
      outputRef.current = "";
      setStatus({ msg: "Ready.", type: "" });
      return;
    }

    const result = decodeJWT(token);
    
    if (result.error) {
      setDecoded("");
      outputRef.current = "";
      setStatus({ msg: "✗ " + result.error, type: "err" });
    } else {
      let output = "";
      output += "=== HEADER ===\n" + JSON.stringify(result.header, null, 2) + "\n\n";
      output += "=== PAYLOAD ===\n" + JSON.stringify(result.payload, null, 2) + "\n\n";
      output += "=== SIGNATURE ===\n" + result.signature + "\n\n";
      
      if (result.expiresIn) {
        output += "=== EXPIRATION ===\n";
        output += `Expires At: ${result.expiresIn}\n`;
        output += `Status: ${result.isExpired ? "⚠ EXPIRED" : "✓ VALID"}`;
      }

      setDecoded(output);
      outputRef.current = output;

      const msg = result.isExpired ? "✗ Token is expired" : "✓ Valid JWT token";
      setStatus({ msg, type: result.isExpired ? "err" : "ok" });
    }
  }, [token]);

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
        <h2 className="tk-tool-title">JWT Token Parser</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={() => outputRef.current} />
          <ActionBtn danger onClick={() => { setToken(""); setDecoded(""); outputRef.current = ""; setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
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
          left={<><PaneLabel>JWT TOKEN</PaneLabel><textarea className="tk-textarea" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your JWT token here..." /></>}
          right={isMaximized ? null : <><PaneLabel>DECODED</PaneLabel><pre className="tk-output-pre">{decoded}</pre></>}
        />
      </div>
      {!isMaximized && <StatusBar {...status} />}
    </div>
  );
}
