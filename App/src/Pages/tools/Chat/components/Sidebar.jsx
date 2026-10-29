import { useState } from "react";
import { QrScanner, buildQrUrl } from "../../tk-shared.jsx";
import { s } from "../styles";
import { formatMac, NAME_MAX } from "../identity";

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }).catch(() => {});
  return <button type="button" onClick={copy} style={s.btnSmall}>{copied ? "✓ Copied" : label}</button>;
}

const STATUS_TEXT = {
  starting: "Starting…",
  online: "Online — reachable by ID",
  offline: "Offline — reconnecting…",
  taken: "Open in another tab — this tab can't receive messages",
  error: "Can't reach the signalling server",
};

function DeviceCard({ me, status, onRename, shareLink, visible, onToggleVisible, presenceAvailable }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(me.name);
  const [showShare, setShowShare] = useState(false);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== me.name) onRename(draft);
    else setDraft(me.name);
  };

  return (
    <div style={s.deviceCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={s.dot(status === "online")} title={STATUS_TEXT[status]} />
        {editing ? (
          <input style={{ ...s.input, flex: 1, padding: "4px 8px" }} value={draft} maxLength={NAME_MAX} autoFocus
            onChange={e => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(me.name); setEditing(false); } }} />
        ) : (
          <button type="button" title="Rename this device" onClick={() => { setDraft(me.name); setEditing(true); }}
            style={{ flex: 1, minWidth: 0, padding: 0, background: "none", border: "none", color: "var(--tk-text)", font: "inherit", fontSize: 15, fontWeight: 600, textAlign: "left", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {me.name} <span style={{ fontSize: 11, color: "var(--tk-text-dim)", fontWeight: 400 }}>✎</span>
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <code style={{ ...s.mac, fontSize: 12, color: "var(--tk-info)" }}>{formatMac(me.mac)}</code>
        <CopyButton text={formatMac(me.mac)} label="Copy" />
        <button type="button" style={s.btnSmall} onClick={() => setShowShare(v => !v)}>{showShare ? "Hide" : "Share"}</button>
      </div>
      <p style={{ ...s.muted, fontSize: 11, marginTop: 4 }}>{STATUS_TEXT[status]}</p>

      {showShare && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <code style={{ flex: 1, minWidth: 0, fontSize: 11, color: "var(--tk-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareLink}</code>
            <CopyButton text={shareLink} label="Copy link" />
          </div>
          <div style={{ textAlign: "center", padding: 10, background: "#fff", borderRadius: 10 }}>
            <img src={buildQrUrl(shareLink, 160)} alt="Scan to chat with this device" width={140} height={140} style={{ display: "block", margin: "0 auto" }} />
          </div>
        </div>
      )}

      {presenceAvailable && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--tk-text-dim)", cursor: "pointer" }}>
          <input type="checkbox" checked={visible} onChange={e => onToggleVisible(e.target.checked)} />
          Show me to devices on my network
        </label>
      )}
    </div>
  );
}

function ConnectById({ onConnect }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const submit = (input) => {
    const err = onConnect(input);
    setError(err || "");
    if (!err) { setValue(""); setScanning(false); }
  };

  return (
    <div style={{ padding: "10px 14px 4px" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="Device ID (AA:BB:CC:…)" value={value}
          onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && submit(value)} />
        <button type="button" style={s.btnSmall} onClick={() => submit(value)} disabled={!value.trim()}>Add</button>
        <button type="button" style={s.btnSmall} onClick={() => setScanning(v => !v)} title="Scan a QR code">📷</button>
      </div>
      {scanning && <div style={{ marginTop: 8 }}><QrScanner onDecode={submit} onCancel={() => setScanning(false)} /></div>}
      {error && <p style={{ ...s.muted, fontSize: 11, color: "var(--tk-accent2)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function PeerRow({ row, active, onSelect }) {
  return (
    <button type="button" className="p2pchat-peer" style={{ ...s.peerRow, ...(active ? s.peerRowActive : null) }} onClick={() => onSelect(row.mac)}>
      <span style={s.dot(row.online)} title={row.online ? "Online" : "Offline"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
          {row.nearby && <span style={s.tag}>this network</span>}
          {!row.contact && <span style={s.tag}>new</span>}
        </div>
        <div style={s.mac}>
          {formatMac(row.mac)}{row.link === "connecting" ? " · connecting…" : ""}
        </div>
      </div>
      {row.unread > 0 && <span style={s.badge}>{row.unread > 99 ? "99+" : row.unread}</span>}
    </button>
  );
}

export function Sidebar({ me, status, onRename, shareLink, visible, onToggleVisible, presence, rows, activeMac, onSelect, onConnect, onRefresh, refreshing }) {
  const active = rows.filter(r => r.online);
  const offline = rows.filter(r => !r.online);
  return (
    <aside className="p2pchat-sidebar" style={s.sidebar}>
      <DeviceCard me={me} status={status} onRename={onRename} shareLink={shareLink}
        visible={visible} onToggleVisible={onToggleVisible} presenceAvailable={presence.available} />
      <ConnectById onConnect={onConnect} />
      <div style={s.peerList}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 10 }}>
          <p style={s.sectionLabel}>Active · {active.length}</p>
          <button type="button" style={{ ...s.btnSmall, padding: "2px 8px", marginTop: 8 }} onClick={onRefresh} disabled={refreshing} title="Refresh">
            {refreshing ? "…" : "⟳"}
          </button>
        </div>
        {active.length === 0 && (
          <p style={{ ...s.muted, fontSize: 12, padding: "0 14px" }}>
            {presence.available ? "No one else online on your network or in your contacts." : "Presence isn't available here — add a device by ID or QR."}
          </p>
        )}
        {active.map(r => <PeerRow key={r.mac} row={r} active={r.mac === activeMac} onSelect={onSelect} />)}
        {offline.length > 0 && <p style={s.sectionLabel}>{presence.available ? "Offline" : "Contacts"} · {offline.length}</p>}
        {offline.map(r => <PeerRow key={r.mac} row={r} active={r.mac === activeMac} onSelect={onSelect} />)}
      </div>
    </aside>
  );
}
