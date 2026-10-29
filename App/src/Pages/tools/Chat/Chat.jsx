import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FaPhone, FaVideo, FaEllipsisV } from "react-icons/fa";
import { navigate, useSearchParams } from "../../../Utils/router";
import { useKeepAliveActive, useKeepAliveRelease } from "../../../Utils/KeepAlive";
import { formatMac } from "./identity";
import { buildPeerList, groupMessages, displayName } from "./history";
import { useChatNetwork } from "./hooks/useChatNetwork";
import { useCall } from "./hooks/useCall";
import { Sidebar } from "./components/Sidebar";
import { ChatBubble, DateDivider, TypingIndicator } from "./components/Messages";
import { MessageComposer } from "./components/Composer";
import { CallPanel } from "./components/CallPanel";
import { ChatIndicator } from "./components/ChatIndicator";
import { s, globalStyles } from "./styles";

const shareLinkFor = (mac) => `${window.location.origin}/toolz/chat?peer=${mac}`;

function ConversationMenu({ row, onRename, onClear, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const item = (label, fn, danger) => (
    <button type="button" style={{ ...s.menuItem, ...(danger ? { color: "var(--tk-accent2)" } : null) }}
      onClick={() => { setOpen(false); fn(); }}>{label}</button>
  );
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" style={s.iconBtn} title="More" onClick={() => setOpen(v => !v)}><FaEllipsisV size={13} /></button>
      {open && (
        <div style={s.menu}>
          {row.contact && item("Set nickname…", onRename)}
          {item("Clear chat history", onClear, true)}
          {row.contact && item("Delete contact & history", onDelete, true)}
        </div>
      )}
    </div>
  );
}

export default function P2PChat() {
  // Kept alive at the app root (Toolz registry `keepAlive`): the device stays
  // online, and links/calls survive switching tools; a ChatIndicator stands
  // in while another page is showing.
  const onScreen = useKeepAliveActive();
  const releaseInstance = useKeepAliveRelease();
  const [error, setError] = useState("");

  const callApi = useRef(null);
  const net = useChatNetwork({
    onScreen,
    onIncomingCall: (c) => callApi.current?.handleIncomingCall(c),
    onCallMeta: (mac, data) => callApi.current?.handleCallMeta(mac, data),
    onLinkClosed: (mac) => callApi.current?.handleLinkClosed(mac),
  });
  const { trustedConn } = net;
  const isTrusted = useCallback((mac) => !!trustedConn(mac), [trustedConn]);
  const call = useCall({ peerRef: net.peerRef, getConn: trustedConn, isTrusted, onError: setError });
  callApi.current = call;

  const rows = useMemo(() => net.identity ? buildPeerList({
    myMac: net.identity.mac, contacts: net.contacts, nearby: net.presence.nearby,
    online: net.presence.online, links: net.links,
  }) : [], [net.identity, net.contacts, net.presence, net.links]);

  const activeMac = net.activeMac;
  const activeRow = rows.find(r => r.mac === activeMac)
    ?? (activeMac ? { mac: activeMac, contact: null, label: displayName(null, activeMac), online: false, link: null } : null);
  const linked = activeMac && net.links[activeMac] === "ready";
  const labelOf = (mac) => rows.find(r => r.mac === mac)?.label ?? displayName(null, mac);

  const messagesEndRef = useRef(null);
  const peerTyping = !!(activeMac && net.typing[activeMac]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [net.messages, peerTyping]);

  // Share links: /toolz/chat?peer=<mac> adds the device and opens the chat.
  // The instance is kept alive, so a link can arrive while it's already
  // mounted: each value is handled once, and only while on screen — when
  // hidden, the URL belongs to another page. Old ?room= invites predate
  // device IDs and can't be honoured.
  const [searchParams] = useSearchParams();
  const peerParam = onScreen && net.identity ? searchParams.get("peer") : null;
  const roomParam = onScreen ? searchParams.get("room") : null;
  const handledParamRef = useRef(null);
  const { addById } = net;
  useEffect(() => {
    const param = peerParam ? `peer:${peerParam}` : roomParam ? `room:${roomParam}` : null;
    if (!param || handledParamRef.current === param) return;
    handledParamRef.current = param;
    if (peerParam) setError(addById(peerParam) || "");
    else setError("This invite link uses the old room-code format. Ask for a new link — chats now connect by device ID.");
  }, [peerParam, roomParam, addById]);

  const grouped = useMemo(() => groupMessages(net.messages), [net.messages]);
  const totalUnread = net.contacts.reduce((n, c) => n + (c.unread || 0), 0);
  const onlineCount = rows.filter(r => r.online).length;

  const { sendText, sendFile, sendTyping } = net;
  const onSendText = useCallback((text) => sendText(activeMac, text), [sendText, activeMac]);
  const onSendFile = useCallback((file) => sendFile(activeMac, file), [sendFile, activeMac]);
  const onTyping = useCallback((value) => sendTyping(activeMac, value), [sendTyping, activeMac]);
  const { deleteMessage } = net;
  const onDeleteMessage = useCallback((id) => deleteMessage(activeMac, id), [deleteMessage, activeMac]);

  const indicator = !onScreen && net.identity && (
    <ChatIndicator
      onlineCount={onlineCount}
      unread={totalUnread}
      callState={call.callState}
      callType={call.callType}
      callPeerLabel={call.callPeer ? labelOf(call.callPeer) : ""}
      onOpen={() => navigate("/toolz/chat")}
      onHangUp={call.endCall}
      onLeave={releaseInstance}
    />
  );

  if (!net.identity) return (
    <div style={s.root} className="p2pchat-root">
      <style>{globalStyles}</style>
      <div style={{ ...s.layout, gridTemplateColumns: "1fr" }}>
        <div style={s.empty}><p style={s.muted}>Setting up this device…</p></div>
      </div>
    </div>
  );

  return (
    <div style={s.root} className="p2pchat-root">
      <style>{globalStyles}</style>
      {indicator}
      {(!net.storageOk || net.status === "taken" || error) && (
        <div style={s.banners}>
          {!net.storageOk && (
            <div style={s.banner}>Browser storage is unavailable — this device&apos;s ID will change next visit and history isn&apos;t saved.</div>
          )}
          {net.status === "taken" && (
            <div style={{ ...s.banner, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>Chat is open in another tab, so this one can&apos;t receive messages.</span>
              <button type="button" style={s.btnSmall} onClick={net.retry}>Use here</button>
            </div>
          )}
          {error && (
            <div style={{ ...s.banner, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{error}</span>
              <button type="button" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }} onClick={() => setError("")}>✕</button>
            </div>
          )}
        </div>
      )}
      <div className="p2pchat-layout" data-open={activeMac ? "true" : "false"} style={s.layout}>
        <Sidebar
          me={net.identity}
          status={net.status}
          onRename={net.rename}
          shareLink={shareLinkFor(net.identity.mac)}
          visible={net.visible}
          onToggleVisible={net.setVisible}
          presence={net.presence}
          rows={rows}
          activeMac={activeMac}
          onSelect={net.openConversation}
          onConnect={net.addById}
          onRefresh={net.refreshPresence}
          refreshing={net.refreshing}
        />

        <section className="p2pchat-main" style={s.main}>
          <CallPanel call={call} peerLabel={call.callPeer ? labelOf(call.callPeer) : ""} />

          {!activeRow ? (
            <div style={s.empty}>
              <div style={{ fontSize: 32 }}>💬</div>
              <p style={s.muted}>Pick a device on the left, or add one by its ID.</p>
              <p style={{ ...s.muted, fontSize: 12 }}>
                Messages go directly between browsers over WebRTC. History stays on this device only.
              </p>
            </div>
          ) : (
            <>
              <div style={s.chatHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <button type="button" className="p2pchat-back" style={s.iconBtn} onClick={() => net.openConversation(null)} title="Back">‹</button>
                  <span style={s.dot(activeRow.online)} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRow.label}</p>
                    <p style={{ ...s.mac, margin: 0 }}>
                      {formatMac(activeMac)} · {linked ? "connected" : net.links[activeMac] === "connecting" ? "connecting…" : activeRow.online ? "online" : "offline"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {linked && call.callState === "idle" && (
                    <>
                      <button style={s.iconBtn} title="Voice call" onClick={() => call.startCall(activeMac, false)}><FaPhone size={14} /></button>
                      <button style={s.iconBtn} title="Video call" onClick={() => call.startCall(activeMac, true)}><FaVideo size={14} /></button>
                    </>
                  )}
                  <ConversationMenu
                    row={activeRow}
                    onRename={() => {
                      const nick = window.prompt("Nickname for this device (empty to clear):", activeRow.contact?.nickname || "");
                      if (nick !== null) net.setNickname(activeMac, nick);
                    }}
                    onClear={() => { if (window.confirm(`Delete all messages with ${activeRow.label} on this device?`)) net.clearHistory(activeMac); }}
                    onDelete={() => { if (window.confirm(`Remove ${activeRow.label} and its chat history from this device?`)) net.deleteContact(activeMac); }}
                  />
                </div>
              </div>

              {net.notice && <div style={s.infoBanner}>{net.notice}</div>}

              <div style={s.messageArea}>
                {net.messages.length === 0 && (
                  <div style={{ textAlign: "center", marginTop: 60, color: "var(--tk-text-dim)" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                    <p style={{ fontSize: 13 }}>{linked ? "Connected! Say hello." : "No messages yet."}</p>
                  </div>
                )}
                {grouped.map(({ msg, showAvatar, showDate }) => {
                  const key = `${activeMac}:${msg.id}`;
                  return (
                    <div key={msg.id}>
                      {showDate && <DateDivider label={new Date(msg.ts).toDateString()} />}
                      <ChatBubble msg={msg} data={net.blobs[key]} progress={net.transfers[key]}
                        showAvatar={showAvatar} peerLabel={activeRow.label} onDelete={onDeleteMessage} />
                    </div>
                  );
                })}
                {peerTyping && <TypingIndicator peerLabel={activeRow.label} />}
                <div ref={messagesEndRef} />
              </div>

              <MessageComposer
                key={activeMac}
                onSendText={onSendText}
                onSendFile={onSendFile}
                onTyping={onTyping}
                canSendFile={linked}
                placeholder={linked ? "Message…" : "Message — delivered when they're online…"}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
