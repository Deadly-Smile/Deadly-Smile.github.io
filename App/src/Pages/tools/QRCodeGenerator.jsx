import { useState, useRef } from 'react';
import { CopyBtn, ActionBtn, StatusBar } from './tk-shared';

export default function QRCodeGenerator() {
  const [input, setInput] = useState('https://example.com');
  const [qrUrl, setQrUrl] = useState('');
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const [size, setSize] = useState(300);
  const [errorCorrection, setErrorCorrection] = useState('M');
  const canvasRef = useRef(null);

  const generateQRCode = () => {
    if (!input.trim()) {
      setStatus({ msg: "✗ Please enter text or URL", type: "err" });
      setQrUrl('');
      return;
    }

    try {
      // Using qr-server.com API for QR generation
      const encodedInput = encodeURIComponent(input.trim());
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedInput}&ecc=${errorCorrection}`;
      
      setQrUrl(url);
      setStatus({ msg: "✓ QR Code generated", type: "ok" });
    } catch (err) {
      setStatus({ msg: "✗ " + err.message, type: "err" });
      setQrUrl('');
    }
  };

  const downloadQRCode = () => {
    if (!qrUrl) {
      setStatus({ msg: "✗ Generate QR code first", type: "err" });
      return;
    }

    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus({ msg: "✓ QR Code downloaded", type: "ok" });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      generateQRCode();
    }
  };

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">QR Code Generator</h2>
        <div className="tk-tool-actions">
          {qrUrl && <ActionBtn onClick={downloadQRCode}>Download</ActionBtn>}
          <ActionBtn onClick={generateQRCode}>Generate</ActionBtn>
          <ActionBtn danger onClick={() => { setInput(''); setQrUrl(''); setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
        </div>
      </div>

      <div className="tk-main">
        {/* Input */}
        <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
          <label className="tk-pane-label">TEXT OR URL</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter text, URL, or any data to encode..."
            className="tk-textarea"
            style={{ minHeight: "80px", fontFamily: "var(--tk-mono)" }}
          />
          <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", marginTop: "0.3rem" }}>
            Tip: Use Ctrl+Enter to generate. Supports URLs, text, emails, phone numbers, etc.
          </p>
        </div>

        {/* Settings */}
        <div className="tk-pane" style={{ marginBottom: "1.5rem" }}>
          <label className="tk-pane-label">SETTINGS</label>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.8rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", color: "var(--tk-text-dim)" }}>
                Size: {size}px
              </label>
              <input
                type="range"
                min="100"
                max="1000"
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", color: "var(--tk-text-dim)" }}>
                Error Correction
              </label>
              <select
                value={errorCorrection}
                onChange={(e) => setErrorCorrection(e.target.value)}
                className="tk-input"
                style={{ width: "100%", padding: "0.4rem" }}
              >
                <option value="L">Low (7%)</option>
                <option value="M">Medium (15%)</option>
                <option value="Q">Quartile (25%)</option>
                <option value="H">High (30%)</option>
              </select>
            </div>
          </div>

          <p style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", marginTop: "0.5rem" }}>
            Higher error correction allows partial damage recovery but increases QR code size
          </p>
        </div>

        {/* QR Code Display */}
        {qrUrl && (
          <div style={{ padding: "1.5rem", background: "var(--tk-surface2)", border: "1px solid var(--tk-border-bright)", borderRadius: "var(--tk-radius)", textAlign: "center" }}>
            <p className="tk-pane-label">RESULT</p>
            <div style={{ marginTop: "1rem", padding: "1rem", background: "white", borderRadius: "var(--tk-radius)", display: "inline-block" }}>
              <img 
                ref={canvasRef}
                src={qrUrl} 
                alt="QR Code" 
                style={{ width: "100%", height: "auto", maxWidth: size }}
                onError={() => setStatus({ msg: "✗ Failed to generate QR code", type: "err" })}
              />
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--tk-text-dim)", marginTop: "0.8rem" }}>
              Right-click to save or click Download button
            </p>
          </div>
        )}

        <StatusBar status={status} />
      </div>
    </div>
  );
}
