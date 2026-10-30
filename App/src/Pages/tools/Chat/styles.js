// Shared inline styles for the chat. The layout breakpoint (sidebar vs.
// conversation on narrow screens) has to be CSS, so it lives in globalStyles.

export const globalStyles = `
@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
.p2pchat-root input::placeholder,
.p2pchat-root textarea::placeholder { color: var(--tk-text-dim); opacity: 1; }
.p2pchat-root .p2pchat-del { opacity: 0; transition: opacity .15s; }
.p2pchat-root .p2pchat-msg:hover .p2pchat-del,
.p2pchat-root .p2pchat-del:focus-visible { opacity: 1; }
@media (hover: none) { .p2pchat-root .p2pchat-del { opacity: .55; } }
.p2pchat-root .p2pchat-peer:hover { background: var(--tk-surface2); }
.p2pchat-root .p2pchat-back { display: none; }
@media (max-width: 680px) {
  .p2pchat-root .p2pchat-layout { grid-template-columns: minmax(0, 1fr) !important; }
  .p2pchat-root .p2pchat-layout[data-open="true"] .p2pchat-sidebar { display: none !important; }
  .p2pchat-root .p2pchat-layout[data-open="false"] .p2pchat-main { display: none !important; }
  .p2pchat-root .p2pchat-back { display: inline-flex; }
}
`;

export const s = {
  root: { maxWidth: 920, margin: "1rem auto", padding: "0 0.5rem", fontFamily: "system-ui,sans-serif", color: "var(--tk-text)" },
  layout: {
    display: "grid", gridTemplateColumns: "290px minmax(0, 1fr)",
    background: "var(--tk-surface)", border: "0.5px solid var(--tk-border)", borderRadius: 14, overflow: "hidden",
    // This tool renders inside the site's own sticky header + topbar + footer, not
    // as a standalone page — clamp() leaves room for that surrounding chrome (~260px)
    // instead of claiming a near-full extra viewport on top of it.
    height: "clamp(460px, calc(100vh - 260px), 760px)",
  },
  sidebar: { display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, borderRight: "0.5px solid var(--tk-border)" },
  main: { display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 },
  deviceCard: { padding: "14px 14px 12px", borderBottom: "0.5px solid var(--tk-border)" },
  sectionLabel: { margin: "12px 14px 4px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tk-text-dim)" },
  peerList: { flex: 1, overflowY: "auto", paddingBottom: 8 },
  peerRow: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 14px",
    background: "transparent", border: "none", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer",
  },
  peerRowActive: { background: "var(--tk-surface2)", boxShadow: "inset 2px 0 0 var(--tk-accent)" },
  mac: { fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--tk-text-dim)", letterSpacing: "0.03em" },
  dot: (online) => ({ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: online ? "var(--tk-accent)" : "var(--tk-border-bright)" }),
  badge: {
    flexShrink: 0, minWidth: 18, padding: "1px 6px", borderRadius: 9, background: "var(--tk-accent)",
    color: "var(--tk-bg)", fontSize: 11, fontWeight: 700, textAlign: "center",
  },
  tag: { fontSize: 10, padding: "1px 5px", borderRadius: 4, border: "0.5px solid var(--tk-border-bright)", color: "var(--tk-text-dim)" },
  empty: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, textAlign: "center", color: "var(--tk-text-dim)" },
  // Device-level notices sit above the layout so they show in both mobile views.
  banners: { marginBottom: 8, borderRadius: 10, overflow: "hidden", border: "0.5px solid var(--tk-border)" },
  banner: { padding: "8px 14px", fontSize: 12, background: "rgba(255, 51, 102, 0.12)", color: "var(--tk-accent2)", borderBottom: "0.5px solid var(--tk-border)" },
  infoBanner: { padding: "8px 14px", fontSize: 12, background: "var(--tk-surface2)", color: "var(--tk-text-dim)", borderBottom: "0.5px solid var(--tk-border)" },
  chatHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
    padding: "10px 14px", borderBottom: "0.5px solid var(--tk-border)",
  },
  menu: {
    position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 5, minWidth: 190,
    display: "flex", flexDirection: "column", padding: 4,
    background: "var(--tk-surface)", border: "0.5px solid var(--tk-border-bright)", borderRadius: 9,
    boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
  },
  menuItem: { padding: "8px 10px", background: "transparent", border: "none", borderRadius: 6, color: "var(--tk-text)", fontSize: 13, textAlign: "left", cursor: "pointer" },
  messageArea: { flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column" },
  callBanner: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
    padding: "10px 16px", background: "var(--tk-surface2)", borderBottom: "0.5px solid var(--tk-border)",
  },
  callPanel: {
    padding: "12px 16px", borderBottom: "0.5px solid var(--tk-border)",
    background: "var(--tk-surface2)", textAlign: "center",
  },
  videoStage: {
    position: "relative", width: "100%", maxWidth: 380, aspectRatio: "4/3", margin: "0 auto",
    background: "#000", borderRadius: 10, overflow: "hidden",
  },
  remoteVideo: { width: "100%", height: "100%", objectFit: "cover" },
  localVideo: {
    position: "absolute", bottom: 8, right: 8, width: "28%", aspectRatio: "4/3",
    objectFit: "cover", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.6)",
  },
  // Second local PiP (own outgoing screen share) — opposite corner from the
  // camera preview so both can show at once.
  localScreenThumb: { bottom: "auto", right: "auto", top: 8, left: 8, border: "1.5px solid rgba(110,231,183,0.85)" },
  inputBar: { display: "flex", gap: 8, alignItems: "flex-end", padding: "10px 12px", borderTop: "0.5px solid var(--tk-border)" },
  stagePreview: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
    borderTop: "0.5px solid var(--tk-border)", background: "var(--tk-surface2)",
  },
  muted: { margin: 0, fontSize: 13, color: "var(--tk-text-dim)", lineHeight: 1.5 },
  input: { padding: "8px 11px", borderRadius: 9, border: "0.5px solid var(--tk-border-bright)", fontSize: 13, outline: "none", background: "var(--tk-surface2)", color: "var(--tk-text)", minWidth: 0 },
  textarea: {
    flex: 1, padding: "9px 13px", borderRadius: 9, border: "0.5px solid var(--tk-border-bright)",
    fontSize: 14, outline: "none", background: "var(--tk-surface2)", color: "var(--tk-text)",
    fontFamily: "inherit", resize: "none", maxHeight: 120, lineHeight: 1.4,
  },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: "var(--tk-accent)", color: "var(--tk-bg)", fontSize: 14, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  btnSmall: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "0.5px solid var(--tk-border-bright)", background: "transparent", color: "var(--tk-text)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" },
  btnDanger: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--tk-accent2)", background: "transparent", color: "var(--tk-accent2)", fontSize: 13, cursor: "pointer" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "6px 10px", borderRadius: 8, border: "0.5px solid var(--tk-border-bright)", background: "var(--tk-surface2)", color: "var(--tk-text)", fontSize: 16, cursor: "pointer", lineHeight: 1 },
  iconBtnActive: { background: "var(--tk-accent)", color: "var(--tk-bg)", borderColor: "var(--tk-accent)" },
};

// The background indicator lives outside .tk-root, so colours are literal
// rather than var(--tk-*).
export const ind = {
  bar: {
    display: "flex", alignItems: "center", gap: 4, maxWidth: 360, padding: 5,
    background: "#111111", border: "1px solid #3a3a3a", borderRadius: 2,
    boxShadow: "0 4px 16px rgba(0,0,0,0.5)", color: "#e8e8e8", fontFamily: "'Space Mono', monospace",
  },
  barRinging: { borderColor: "#00ff88", boxShadow: "0 0 0 2px rgba(0,255,136,0.25), 0 4px 16px rgba(0,0,0,0.5)" },
  title: {
    display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1, padding: "5px 6px",
    background: "transparent", border: "none", color: "inherit", font: "inherit", fontSize: 12,
    cursor: "pointer", textAlign: "left",
  },
  titleText: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  badge: {
    flexShrink: 0, minWidth: 18, padding: "1px 5px", borderRadius: 9, background: "#00ff88",
    color: "#0a0a0a", fontSize: 11, fontWeight: 700, textAlign: "center",
  },
  btn: {
    flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: "2rem", height: "2rem", background: "transparent", border: "1px solid #3a3a3a",
    borderRadius: 2, color: "#e8e8e8", cursor: "pointer", fontSize: 13,
  },
};
