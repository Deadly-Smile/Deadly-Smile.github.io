import { useState, useEffect, useRef, useCallback } from "react";
import Peer from "peerjs";
import { getIceServers } from "../../tk-shared.jsx";
import * as db from "../db";
import { peerIdFor, macFromPeerId, parseMac, randomName, cleanName } from "../identity";
import { generateKeys, exportPublicKey, macFromPublicKey, randomNonce, signChallenge, verifyChallenge } from "../auth";
import { incomingText, upsertMessage } from "../history";
import { heartbeat, goOffline, PRESENCE_INTERVAL_MS } from "../presence";
import { sendFileChunked, parseFileStart, concatArrayBuffers, CHUNK_SIZE } from "../transfer";

const HANDSHAKE_TIMEOUT_MS = 15000;
const RECONNECT_DELAY_MS = 4000;
const noop = () => {};
const pendingIn = (handshakes, mac) => [...handshakes].filter(l => l.mac === mac);

// Everything below the UI: this device's identity and PeerJS instance, one
// DataConnection ("link") per peer, the handshake that proves each peer owns
// its MAC (auth.js), contacts + history in IndexedDB (db.js), presence
// polling, and file transfers.
//
// The device listens on its own MAC-derived peer id, so any number of peers
// can be linked at once. Nothing but the handshake is accepted on a link
// until it is trusted. Text sent while a peer is unreachable is stored as
// "queued" and flushed the next time a link to it becomes trusted.
export function useChatNetwork({ onScreen, onIncomingCall, onCallMeta, onLinkClosed }) {
  const [identity, setIdentity] = useState(null);     // { keys, pubKey, mac, name }
  const [storageOk, setStorageOk] = useState(true);
  const [status, setStatus] = useState("starting");   // starting | online | offline | taken | error
  const [contacts, setContacts] = useState([]);
  const [presence, setPresence] = useState({ available: false, nearby: [], online: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [links, setLinks] = useState({});             // mac → "connecting" | "ready"
  const [typing, setTyping] = useState({});           // mac → bool
  const [activeMac, setActiveMac] = useState(null);
  const [messages, setMessages] = useState([]);       // active conversation only
  const [blobs, setBlobs] = useState({});             // "mac:id" → Blob (this session only)
  const [transfers, setTransfers] = useState({});     // "mac:id" → progress 0..1
  const [notice, setNotice] = useState("");
  const [visible, setVisibleState] = useState(true);

  const identityRef = useRef(null);
  const peerRef = useRef(null);
  const linksRef = useRef(new Map());                 // mac → trusted link { conn, mac, outgoing, trusted, myNonce, theirPub, theirName, chain, timer }
  const handshakesRef = useRef(new Set());            // links still proving who they are
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const activeMacRef = useRef(activeMac);
  activeMacRef.current = activeMac;
  const onScreenRef = useRef(onScreen);
  onScreenRef.current = onScreen;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const incomingTransfersRef = useRef(new Map());     // "mac:id" → { chunks, received, totalChunks, mime }
  const callbacksRef = useRef({});
  callbacksRef.current = { onIncomingCall, onCallMeta, onLinkClosed };
  const presenceTickRef = useRef(noop);
  const reconnectTimerRef = useRef(null);
  const unmountedRef = useRef(false);

  // ─── Contacts ─────────────────────────────────────────────────────────────
  // Writes through to IndexedDB; if storage is unavailable the change still
  // lands in memory for this session.
  const patchContact = useCallback(async (mac, update) => {
    let next;
    try {
      next = await db.updateContact(mac, update);
    } catch {
      next = update(contactsRef.current.find(c => c.mac === mac));
    }
    if (next) {
      contactsRef.current = [...contactsRef.current.filter(c => c.mac !== mac), next];
      setContacts(contactsRef.current);
    }
    return next;
  }, []);

  const ensureContact = useCallback((mac, fields = {}) => patchContact(mac, (c) => ({
    mac, name: "", nickname: "", pubKey: null, unread: 0, queued: 0, lastMessageAt: 0, addedAt: Date.now(),
    ...c, ...fields,
  })), [patchContact]);

  // ─── Links ────────────────────────────────────────────────────────────────
  const syncLinkState = useCallback((mac) => {
    if (unmountedRef.current) return;
    const state = linksRef.current.has(mac) ? "ready"
      : [...handshakesRef.current].some(l => l.mac === mac) ? "connecting" : null;
    setLinks(prev => {
      const next = { ...prev };
      if (state) next[mac] = state; else delete next[mac];
      return next;
    });
  }, []);

  const trustedConn = useCallback((mac) => {
    const link = linksRef.current.get(mac);
    return link?.trusted && link.conn.open ? link.conn : null;
  }, []);

  const showMessage = useCallback((msg) => {
    if (activeMacRef.current === msg.peer) setMessages(prev => upsertMessage(prev, msg));
  }, []);

  const flushQueued = useCallback(async (mac, conn) => {
    let queued = [];
    try { queued = await db.getQueuedMessages(mac); } catch { /* storage unavailable */ }
    for (const msg of queued) {
      if (!conn.open) return;
      conn.send({ type: "text", text: msg.text, id: msg.id });
      db.updateMessage(mac, msg.id, { status: "sent" }).catch(noop);
      showMessage({ ...msg, status: "sent" });
    }
    await patchContact(mac, c => (c?.queued ? { ...c, queued: 0 } : null));
  }, [patchContact, showMessage]);

  const receive = useCallback(async (msg) => {
    db.putMessage(msg).catch(noop);
    showMessage(msg);
    const viewing = activeMacRef.current === msg.peer && onScreenRef.current;
    await patchContact(msg.peer, c => c && ({ ...c, lastMessageAt: msg.ts, unread: viewing ? 0 : (c.unread || 0) + 1 }));
  }, [patchContact, showMessage]);

  const dropTransfersFor = useCallback((mac) => {
    for (const key of incomingTransfersRef.current.keys()) {
      if (key.startsWith(mac + ":")) incomingTransfersRef.current.delete(key);
    }
    setTransfers(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(mac + ":"))));
  }, []);

  const handleTrustedData = useCallback(async (mac, conn, data) => {
    switch (data.type) {
      case "bye":
        conn.close();
        return;
      case "typing":
        setTyping(prev => ({ ...prev, [mac]: !!data.value }));
        return;
      case "profile": {
        const name = cleanName(data.name);
        if (name) await patchContact(mac, c => c && ({ ...c, name }));
        return;
      }
      case "call-meta":
        callbacksRef.current.onCallMeta?.(mac, data);
        return;
      case "delivered":
        if (typeof data.id !== "string") return;
        db.updateMessage(mac, data.id, { status: "delivered" }).catch(noop);
        if (activeMacRef.current === mac) setMessages(prev => prev.map(m => m.id === data.id ? { ...m, status: "delivered" } : m));
        return;
      case "text": {
        const msg = incomingText(data, mac, Date.now());
        if (!msg) return;
        setTyping(prev => ({ ...prev, [mac]: false }));
        await receive(msg);
        conn.send({ type: "delivered", id: msg.id });
        return;
      }
      case "file-start": {
        const meta = parseFileStart(data);
        const key = meta && `${mac}:${meta.id}`;
        if (!meta || incomingTransfersRef.current.has(key)) return;
        incomingTransfersRef.current.set(key, { chunks: new Array(meta.totalChunks), received: 0, totalChunks: meta.totalChunks, mime: meta.mime });
        setTransfers(prev => ({ ...prev, [key]: 0 }));
        await receive({ peer: mac, id: meta.id, from: "them", type: "file", name: meta.name, mime: meta.mime, size: meta.size, ts: Date.now(), status: "delivered" });
        return;
      }
      case "file-chunk": {
        const key = `${mac}:${data.id}`;
        const transfer = incomingTransfersRef.current.get(key);
        if (!transfer || !Number.isInteger(data.index) || data.index < 0 || data.index >= transfer.totalChunks) return;
        let buf = data.data;
        if (ArrayBuffer.isView(buf)) buf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        if (!(buf instanceof ArrayBuffer) || buf.byteLength > CHUNK_SIZE || transfer.chunks[data.index]) return;
        transfer.chunks[data.index] = buf;
        transfer.received += 1;
        if (transfer.received === transfer.totalChunks) {
          incomingTransfersRef.current.delete(key);
          const blob = new Blob([concatArrayBuffers(transfer.chunks)], { type: transfer.mime });
          setBlobs(prev => ({ ...prev, [key]: blob }));
          setTransfers(prev => { const next = { ...prev }; delete next[key]; return next; });
          conn.send({ type: "delivered", id: data.id });
        } else {
          const progress = transfer.received / transfer.totalChunks;
          setTransfers(prev => ({ ...prev, [key]: progress }));
        }
        return;
      }
      default:
    }
  }, [patchContact, receive]);

  // Handshake first (see auth.js): nothing else is processed on a link until
  // the peer has proven it owns `mac`.
  const handleData = useCallback(async (link, mac, data) => {
    const me = identityRef.current;
    const { conn } = link;
    if (!data || typeof data !== "object" || !me) return;

    if (link.trusted) return handleTrustedData(mac, conn, data);

    if (data.type === "hello" && !link.theirPub) {
      if (typeof data.pubKey !== "string" || data.pubKey.length > 512 || typeof data.nonce !== "string" || data.nonce.length > 64) {
        conn.close();
        return;
      }
      let derived = null;
      try { derived = await macFromPublicKey(data.pubKey); } catch { /* malformed key */ }
      const known = contactsRef.current.find(c => c.mac === mac);
      if (derived !== mac || (known?.pubKey && known.pubKey !== data.pubKey)) {
        if (activeMacRef.current === mac) setNotice("Rejected a connection that couldn't prove it is this device.");
        conn.close();
        return;
      }
      link.theirPub = data.pubKey;
      link.theirName = cleanName(data.name);
      conn.send({ type: "auth", sig: await signChallenge(me.keys.privateKey, data.nonce, me.mac, mac) });
      return;
    }

    if (data.type === "auth" && link.theirPub && typeof data.sig === "string") {
      const ok = await verifyChallenge(link.theirPub, data.sig, link.myNonce, mac, me.mac);
      if (!ok) { conn.close(); return; }
      link.trusted = true;
      clearTimeout(link.timer);
      handshakesRef.current.delete(link);
      // Both devices may have dialled each other at once. Only links that
      // completed the handshake compete, and both sides keep the one dialled
      // by the smaller MAC (or the newer one if the same side dialled both),
      // so they always settle on the same link.
      const existing = linksRef.current.get(mac);
      if (existing?.conn.open) {
        const dialer = (l) => (l.outgoing ? me.mac : mac);
        if (dialer(existing) !== dialer(link) && dialer(existing) < dialer(link)) {
          conn.close();
          return;
        }
        linksRef.current.set(mac, link);
        existing.conn.close();
      } else {
        linksRef.current.set(mac, link);
      }
      await ensureContact(mac, { pubKey: link.theirPub, lastSeen: Date.now(), ...(link.theirName ? { name: link.theirName } : null) });
      syncLinkState(mac);
      if (activeMacRef.current === mac) setNotice("");
      await flushQueued(mac, conn);
    }
  }, [handleTrustedData, ensureContact, syncLinkState, flushQueued]);

  const wireConn = useCallback((conn, mac, outgoing) => {
    const link = { conn, mac, outgoing, trusted: false, myNonce: randomNonce(), theirPub: null, theirName: "", chain: Promise.resolve(), timer: null };
    handshakesRef.current.add(link);
    syncLinkState(mac);
    link.timer = setTimeout(() => { if (!link.trusted) conn.close(); }, HANDSHAKE_TIMEOUT_MS);

    const sendHello = () => {
      const me = identityRef.current;
      conn.send({ type: "hello", pubKey: me.pubKey, nonce: link.myNonce, name: me.name });
    };
    if (conn.open) sendHello(); else conn.on("open", sendHello);

    // Handlers are async (WebCrypto, IndexedDB); chaining keeps a link's
    // messages processed in arrival order.
    conn.on("data", (data) => {
      link.chain = link.chain.then(() => handleData(link, mac, data)).catch(noop);
    });
    conn.on("close", () => {
      clearTimeout(link.timer);
      handshakesRef.current.delete(link);
      if (linksRef.current.get(mac) !== link) { syncLinkState(mac); return; } // never won, or replaced
      linksRef.current.delete(mac);
      if (unmountedRef.current) return;
      syncLinkState(mac);
      setTyping(prev => ({ ...prev, [mac]: false }));
      dropTransfersFor(mac);
      callbacksRef.current.onLinkClosed?.(mac);
    });
    conn.on("error", () => conn.close());
  }, [handleData, syncLinkState, dropTransfersFor]);

  // Duplicate links are resolved once they're trusted (handleData), not here:
  // a pending link may be one whose offer never arrived.
  const acceptIncoming = useCallback((conn) => {
    const me = identityRef.current;
    const mac = macFromPeerId(conn.peer);
    if (!me || !mac || mac === me.mac || pendingIn(handshakesRef.current, mac).length >= 3) { conn.close(); return; }
    wireConn(conn, mac, false);
  }, [wireConn]);

  const connect = useCallback((mac) => {
    const peer = peerRef.current;
    // Dialling before the peer has registered with the signalling server
    // loses the offer; peer.on("open") dials the open conversation instead.
    if (!peer?.open || linksRef.current.has(mac) || pendingIn(handshakesRef.current, mac).some(l => l.outgoing)) return;
    wireConn(peer.connect(peerIdFor(mac), { reliable: true }), mac, true);
  }, [wireConn]);

  // ─── Peer lifecycle ───────────────────────────────────────────────────────
  const startPeer = useCallback(async () => {
    const me = identityRef.current;
    if (!me || unmountedRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    peerRef.current?.destroy();
    setStatus("starting");
    const iceServers = await getIceServers();
    if (unmountedRef.current) return;
    const peer = new Peer(peerIdFor(me.mac), { config: { iceServers } });
    peerRef.current = peer;
    let gaveUp = false;

    const retryLater = () => {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (peerRef.current !== peer || unmountedRef.current) return;
        if (peer.destroyed) startPeer();
        else if (peer.disconnected) peer.reconnect();
      }, RECONNECT_DELAY_MS);
    };

    // Anything dialled before the peer opened (e.g. a ?peer= link) was dropped.
    peer.on("open", () => {
      setStatus("online");
      if (activeMacRef.current) connect(activeMacRef.current);
    });
    peer.on("connection", acceptIncoming);
    peer.on("call", (call) => callbacksRef.current.onIncomingCall?.(call));
    peer.on("disconnected", () => {
      if (peerRef.current !== peer || unmountedRef.current || gaveUp) return;
      setStatus("offline");
      retryLater();
    });
    peer.on("error", (e) => {
      if (peerRef.current !== peer || unmountedRef.current) return;
      if (e.type === "unavailable-id") {
        // PeerJS destroys the peer right after this, which also fires
        // "disconnected" — that must not schedule a retry, or this tab would
        // keep fighting the other one for the id.
        gaveUp = true;
        clearTimeout(reconnectTimerRef.current);
        setStatus("taken");
        peer.destroy();
        return;
      }
      if (e.type === "peer-unavailable") {
        const mac = macFromPeerId(String(e.message).match(/dsc-[0-9a-f]{12}/)?.[0]);
        if (mac) pendingIn(handshakesRef.current, mac).filter(l => l.outgoing).forEach(l => l.conn.close());
        if (mac && mac === activeMacRef.current) setNotice("That device isn't reachable right now — text you send will be delivered when it's back.");
        return;
      }
      if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) {
        setStatus("error");
        retryLater();
      }
    });
  }, [acceptIncoming, connect]);

  // Load (or create) this device's identity once, then go online.
  useEffect(() => {
    unmountedRef.current = false;
    let cancelled = false;
    (async () => {
      let stored = null;
      let ok = true;
      try { stored = await db.loadIdentity(); } catch { ok = false; }
      if (!stored?.keys || !stored.mac) {
        const keys = await generateKeys();
        const pubKey = await exportPublicKey(keys.publicKey);
        stored = { keys, pubKey, mac: await macFromPublicKey(pubKey), name: randomName(), visible: true };
        if (cancelled) return;
        if (ok) { try { await db.saveIdentity(stored); } catch { ok = false; } }
      }
      let saved = [];
      if (ok) { try { saved = await db.getContacts(); } catch { /* treated as empty */ } }
      if (cancelled) return;
      identityRef.current = stored;
      contactsRef.current = saved;
      setStorageOk(ok);
      setIdentity(stored);
      setVisibleState(stored.visible !== false);
      setContacts(saved);
      startPeer();
    })();

    const links = linksRef.current;
    const handshakes = handshakesRef.current;
    const incoming = incomingTransfersRef.current;
    return () => {
      cancelled = true;
      unmountedRef.current = true;
      clearTimeout(reconnectTimerRef.current);
      if (identityRef.current) goOffline(identityRef.current.mac);
      for (const link of links.values()) { clearTimeout(link.timer); link.conn.close(); }
      for (const link of handshakes) { clearTimeout(link.timer); link.conn.close(); }
      links.clear();
      handshakes.clear();
      incoming.clear();
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [startPeer]);

  // ─── Presence ─────────────────────────────────────────────────────────────
  const mac = identity?.mac;
  const taken = status === "taken";
  useEffect(() => {
    if (!mac || taken) return;
    let stopped = false;
    const tick = async () => {
      const me = identityRef.current;
      const result = await heartbeat({
        mac: me.mac, name: me.name, visible: visibleRef.current,
        contacts: contactsRef.current.map(c => c.mac),
      });
      if (stopped) return;
      setPresence(result);
      // Deliver queued text: dial contacts that are online (or, without a
      // presence server, every contact with something waiting).
      const onlineSet = new Set([...result.online, ...result.nearby].map(p => p.mac));
      const reachable = (m) => !result.available || onlineSet.has(m);
      for (const c of contactsRef.current) {
        if (c.queued > 0 && reachable(c.mac)) connect(c.mac);
      }
      // Keep retrying the open conversation too.
      if (activeMacRef.current && reachable(activeMacRef.current)) connect(activeMacRef.current);
    };
    presenceTickRef.current = async () => { setRefreshing(true); await tick(); setRefreshing(false); };
    tick();
    const timer = setInterval(tick, PRESENCE_INTERVAL_MS);
    // A closing tab otherwise only shows up as a dead link after WebRTC's
    // consent check times out (30s+), so tell linked peers right away.
    const onPageHide = () => {
      goOffline(mac);
      for (const link of linksRef.current.values()) {
        if (link.trusted && link.conn.open) link.conn.send({ type: "bye" });
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      stopped = true;
      clearInterval(timer);
      presenceTickRef.current = noop;
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [mac, taken, connect]);

  // Opening a conversation clears its unread count.
  useEffect(() => {
    if (!activeMac || !onScreen) return;
    patchContact(activeMac, c => (c?.unread ? { ...c, unread: 0 } : null));
  }, [activeMac, onScreen, patchContact]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const openConversation = useCallback(async (target) => {
    setActiveMac(target);
    activeMacRef.current = target;
    setMessages([]);
    setNotice("");
    if (!target) return;
    if (!linksRef.current.has(target)) connect(target);
    let loaded = [];
    try { loaded = await db.getMessages(target); } catch { /* storage unavailable */ }
    if (activeMacRef.current !== target) return;
    // Messages that arrived while history was loading are already in state.
    setMessages(prev => prev.reduce(upsertMessage, loaded));
  }, [connect]);

  // Returns an error string for the input, or null on success.
  const addById = useCallback((input) => {
    let raw = String(input || "").trim();
    try { raw = new URL(raw).searchParams.get("peer") || raw; } catch { /* not a URL */ }
    const target = parseMac(raw);
    if (!target) return "That doesn't look like a device ID.";
    if (target === identityRef.current?.mac) return "That's this device.";
    ensureContact(target);
    openConversation(target);
    return null;
  }, [ensureContact, openConversation]);

  const sendText = useCallback((target, text) => {
    const conn = trustedConn(target);
    const msg = { peer: target, id: crypto.randomUUID(), from: "me", type: "text", text, ts: Date.now(), status: conn ? "sent" : "queued" };
    if (conn) conn.send({ type: "text", text, id: msg.id });
    db.putMessage(msg).catch(noop);
    showMessage(msg);
    ensureContact(target, {}).then(() => patchContact(target, c => c && ({
      ...c, lastMessageAt: msg.ts, queued: (c.queued || 0) + (conn ? 0 : 1),
    })));
    if (!conn) connect(target);
  }, [trustedConn, showMessage, ensureContact, patchContact, connect]);

  const sendFile = useCallback(async (target, file) => {
    const conn = trustedConn(target);
    if (!conn) return;
    const id = crypto.randomUUID();
    const key = `${target}:${id}`;
    const msg = { peer: target, id, from: "me", type: "file", name: file.name, mime: file.type, size: file.size, ts: Date.now(), status: "sent" };
    // The sender already has the full file locally, so its own bubble can preview
    // it immediately — only the progress bar reflects the actual transfer to the peer.
    setBlobs(prev => ({ ...prev, [key]: file }));
    setTransfers(prev => ({ ...prev, [key]: 0 }));
    db.putMessage(msg).catch(noop);
    showMessage(msg);
    patchContact(target, c => c && ({ ...c, lastMessageAt: msg.ts }));
    await sendFileChunked(conn, file, id, (progress) => setTransfers(prev => ({ ...prev, [key]: progress })));
    setTransfers(prev => { const next = { ...prev }; delete next[key]; return next; });
  }, [trustedConn, showMessage, patchContact]);

  const sendTyping = useCallback((target, value) => {
    trustedConn(target)?.send({ type: "typing", value });
  }, [trustedConn]);

  const saveIdentity = useCallback((patch) => {
    const next = { ...identityRef.current, ...patch };
    identityRef.current = next;
    setIdentity(next);
    db.saveIdentity(next).catch(noop);
    return next;
  }, []);

  const rename = useCallback((name) => {
    const clean = cleanName(name);
    if (!clean) return;
    saveIdentity({ name: clean });
    for (const link of linksRef.current.values()) {
      if (link.trusted && link.conn.open) link.conn.send({ type: "profile", name: clean });
    }
    presenceTickRef.current();
  }, [saveIdentity]);

  const setVisible = useCallback((value) => {
    setVisibleState(value);
    visibleRef.current = value;
    saveIdentity({ visible: value });
    presenceTickRef.current();
  }, [saveIdentity]);

  const setNickname = useCallback((target, nickname) => {
    patchContact(target, c => c && ({ ...c, nickname: cleanName(nickname) }));
  }, [patchContact]);

  const dropBlobsFor = useCallback((target) => {
    setBlobs(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(target + ":"))));
  }, []);

  const deleteMessage = useCallback((target, id) => {
    db.deleteMessage(target, id).catch(noop);
    setMessages(prev => prev.filter(m => m.id !== id));
    setBlobs(prev => { const next = { ...prev }; delete next[`${target}:${id}`]; return next; });
  }, []);

  const clearHistory = useCallback(async (target) => {
    await db.clearMessages(target).catch(noop);
    if (activeMacRef.current === target) setMessages([]);
    dropBlobsFor(target);
    await patchContact(target, c => c && ({ ...c, unread: 0, queued: 0, lastMessageAt: 0 }));
  }, [patchContact, dropBlobsFor]);

  const deleteContact = useCallback(async (target) => {
    linksRef.current.get(target)?.conn.close();
    pendingIn(handshakesRef.current, target).forEach(l => l.conn.close());
    await db.deleteContactAndHistory(target).catch(noop);
    contactsRef.current = contactsRef.current.filter(c => c.mac !== target);
    setContacts(contactsRef.current);
    dropBlobsFor(target);
    if (activeMacRef.current === target) openConversation(null);
  }, [openConversation, dropBlobsFor]);

  const refreshPresence = useCallback(() => presenceTickRef.current(), []);

  return {
    identity, storageOk, status, contacts, presence, refreshing, links, typing, notice, visible,
    activeMac, messages, blobs, transfers,
    peerRef, trustedConn,
    openConversation, addById, sendText, sendFile, sendTyping,
    rename, setVisible, setNickname, deleteMessage, clearHistory, deleteContact,
    refreshPresence, retry: startPeer,
  };
}
