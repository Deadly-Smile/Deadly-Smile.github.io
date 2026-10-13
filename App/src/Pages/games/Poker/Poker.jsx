import { useState, useEffect, useRef, useCallback } from "react";
import * as engine from "./engine";
import { decideAction } from "./ai";
import { rankLabel, describeHand } from "./handEvaluator";
import { OddsBadge, OddsModal } from "./OddsHelper";
import { useOdds } from "./useOdds";
import { hostRoom, joinRoomAsClient, broadcastState, redactStateForSeat, nextOpenSeat } from "./multiplayer";
import { buildQrUrl, registerOpenRoom, unregisterOpenRoom, fetchOpenRooms } from "../../tools/tk-shared.jsx";
import { usePersistentState, readPersisted, writePersisted, removePersisted } from "../../../Utils/usePersistentState";
import { AVATARS, randomIdentity } from "./identity";
import { diffEvents, isSeatsTurn } from "./soundEvents";
import { playEvents } from "./sounds";
import { Avatar, IdentityPicker, TableSettings, SeatList } from "./TableSetup";

const HUMAN_ID = 0;
const RED_SUITS = new Set(["h", "d"]);
const SUIT_SYMBOL = { s: "♠", h: "♥", d: "♦", c: "♣" };
const ROOM_HEARTBEAT_MS = 20000;

// Lays out `n` seats clockwise around an oval, starting at the bottom.
// Computed rather than a fixed table — the seat count is adjustable
// (engine.MIN_SEATS..MAX_SEATS) so there's no fixed layout to hardcode. The
// table view rotates the seats so the viewer's own is always slot 0.
function generateSeatPositions(n) {
  const RX = 42, RY = 38, CX = 50, CY = 50;
  return Array.from({ length: n }, (_, i) => {
    const theta = (i * 2 * Math.PI) / n;
    return {
      top: `${(CY + RY * Math.cos(theta)).toFixed(1)}%`,
      left: `${(CX - RX * Math.sin(theta)).toFixed(1)}%`,
    };
  });
}

function buildShareLink(roomId) {
  return `${window.location.origin}/games/poker?room=${roomId}`;
}

// Preserves which seats are guest-controlled (and their names) across a
// rematch — a host restarting shouldn't have to re-share the room.
function resetForRematch(prevState) {
  const host = prevState.players[HUMAN_ID];
  const fresh = engine.createInitialState(prevState.players.length, prevState.config, host);
  fresh.players = fresh.players.map((p, i) => {
    const prevPlayer = prevState.players[i];
    return i !== HUMAN_ID && prevPlayer?.isHuman
      ? { ...p, isHuman: true, name: prevPlayer.name, avatar: prevPlayer.avatar }
      : p;
  });
  return fresh;
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  return (
    <button onClick={copy} className="px-3 py-1.5 text-xs rounded-full bg-slate-700 hover:bg-slate-600 transition-colors">
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function Card({ card, hidden, size = "md", dealt = true }) {
  const dims = size === "lg" ? "w-12 h-[68px] text-base"
    : size === "xs" ? "w-6 h-[38px] text-[10px]"
    // Used for in-seat hole cards — small enough to fit narrow mobile seats,
    // full-size once there's room to spare.
    : size === "seat" ? "w-6 h-[38px] text-[10px] sm:w-9 sm:h-[52px] sm:text-xs"
    : "w-9 h-[52px] text-xs";
  const base = `${dims} rounded-md flex-shrink-0 shadow-md`;
  if (hidden || !card || card.rank == null) {
    return (
      <div className={`${base} card-back`} />
    );
  }
  const red = RED_SUITS.has(card.suit);
  return (
    <div className={`${base} bg-white border border-slate-300 relative overflow-hidden ${dealt ? "card-deal" : ""} ${red ? "text-red-600" : "text-slate-900"}`}>
      <div className="absolute top-0.5 left-1 font-bold leading-none">{rankLabel(card.rank)}</div>
      <div className="absolute inset-0 flex items-center justify-center text-xl">{SUIT_SYMBOL[card.suit]}</div>
    </div>
  );
}

function StackBadge({ amount }) {
  return (
    <div className="flex items-center gap-1 text-emerald-300 font-mono text-[11px]">
      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-200/60" />
      ${amount}
    </div>
  );
}

function Seat({ player, isDealer, isActing, showFace, isWinner, isMe, position }) {
  const busted = player.stack === 0 && !player.inHand;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 w-[76px] sm:w-28"
      style={position}
    >
      {isDealer && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-yellow-300 text-black text-[10px] font-bold flex items-center justify-center shadow border border-yellow-500 z-10">D</div>
      )}
      <div
        className={[
          "rounded-xl border-2 px-1 py-1 sm:px-2 sm:py-2 flex flex-col items-center gap-0.5 sm:gap-1 bg-slate-800/90 backdrop-blur-sm w-full",
          isWinner ? "border-yellow-400 seat-winner" : isActing ? "border-amber-400 seat-active" : "border-slate-700",
          player.folded || busted ? "opacity-35" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-1 w-full min-w-0 justify-center">
          <Avatar avatar={player.avatar} size="sm" />
          <span className={`text-[10px] sm:text-xs font-semibold truncate ${isMe ? "text-indigo-300" : "text-white"}`}>{player.name}</span>
        </div>
        <div className="flex gap-0.5 sm:gap-1">
          {player.holeCards.length > 0
            ? player.holeCards.map((c, i) => <Card key={i} card={c} hidden={!showFace} size="seat" />)
            : <Card hidden size="seat" />}
        </div>
        <StackBadge amount={player.stack} />
        {player.streetBet > 0 && (
          <div className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
            bet ${player.streetBet}
          </div>
        )}
        {player.folded && !busted && <div className="text-[10px] text-slate-500">folded</div>}
        {player.allIn && !player.folded && <div className="text-[10px] text-red-400 font-semibold">ALL-IN</div>}
        {busted && <div className="text-[10px] text-slate-500">out</div>}
      </div>
    </div>
  );
}

const SOLO_SAVE_KEY = "game:poker:solo";

// A solo table left mid-session, unless a shared room link takes priority.
function readSoloSave() {
  if (new URLSearchParams(window.location.search).get("room")) return null;
  const s = readPersisted(SOLO_SAVE_KEY, null);
  return s && Array.isArray(s.players) && s.players.length && Array.isArray(s.log) && s.handNumber > 0 ? s : null;
}

export default function Poker() {
  const [soloSave] = useState(readSoloSave);
  const [state, setState] = useState(() => soloSave ?? engine.createInitialState());
  const [view, setView] = useState(() => (soloSave ? "table" : "menu")); // menu | lobby | table
  const [role, setRole] = useState("solo"); // solo | host | client
  const [mySeatId, setMySeatId] = useState(HUMAN_ID);

  const [multiplayerMode, setMultiplayerMode] = useState(null); // null | "host" | "join"
  const [seatCount, setSeatCount] = usePersistentState("game:poker:seatCount", engine.MAX_SEATS);
  const [config, setConfig] = usePersistentState("game:poker:config", engine.DEFAULT_CONFIG);
  const [identity, setIdentity] = usePersistentState("game:poker:identity", () => randomIdentity());
  const [soundOn, setSoundOn] = usePersistentState("game:poker:sound", true);
  const [joinInput, setJoinInput] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [roomId, setRoomId] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [confirming, setConfirming] = useState(null); // null | "quit" | "restart" — armed header button

  const logEndRef = useRef(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const peerRef = useRef(null);
  const connectionsRef = useRef(new Map());   // host: seatId -> DataConnection
  const connToSeatRef = useRef(new Map());    // host: DataConnection -> seatId
  const clientConnRef = useRef(null);         // client: its one connection to the host
  const roomHeartbeatRef = useRef(null);
  const autoJoinedRef = useRef(false);
  // Set right before a deliberate teardown (e.g. being kicked) so the
  // DataConnection's own "close" event — which fires right after, since
  // teardownNetwork closes that same connection — doesn't stomp the more
  // specific status message with a generic "Disconnected from host."
  const suppressCloseMsgRef = useRef(false);

  // ─── Networking teardown ───────────────────────────────────────────────────
  // A ref (not the roomId state) so the mount-only cleanup effect below always
  // reads the *current* room, not whatever it was on first render.
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const teardownNetwork = useCallback(() => {
    clearInterval(roomHeartbeatRef.current);
    roomHeartbeatRef.current = null;
    if (roomIdRef.current) unregisterOpenRoom(roomIdRef.current);
    clientConnRef.current?.close();
    for (const conn of connectionsRef.current.values()) conn.close();
    connectionsRef.current.clear();
    connToSeatRef.current.clear();
    peerRef.current?.destroy();
    peerRef.current = null;
    clientConnRef.current = null;
  }, []);

  useEffect(() => teardownNetwork, [teardownNetwork]); // stable ref — runs teardown only on real unmount

  // ─── Host-side handlers (registered once per hostRoom() call) ─────────────
  const handleGuestJoin = useCallback((conn, { name, avatar }) => {
    const seat = nextOpenSeat(connectionsRef.current, stateRef.current.players.length);
    if (seat === -1) { conn.send({ type: "full" }); conn.close(); return; }
    connectionsRef.current.set(seat, conn);
    connToSeatRef.current.set(conn, seat);
    const next = structuredClone(stateRef.current);
    next.players[seat].isHuman = true;
    if (name) next.players[seat].name = String(name).slice(0, 16);
    if (AVATARS.includes(avatar)) next.players[seat].avatar = avatar;
    conn.send({ type: "welcome", seatId: seat, state: redactStateForSeat(next, seat) });
    setState(next);
  }, []);

  const handleGuestAction = useCallback((conn, msg) => {
    const seat = connToSeatRef.current.get(conn);
    if (seat == null) return;
    if (msg?.type === "action") setState(engine.applyAction(stateRef.current, seat, msg.actionType, msg.amount));
    else if (msg?.type === "rebuy") setState(engine.rebuy(stateRef.current, seat));
  }, []);

  const handleGuestLeave = useCallback((conn) => {
    const seat = connToSeatRef.current.get(conn);
    if (seat == null) return;
    connectionsRef.current.delete(seat);
    connToSeatRef.current.delete(conn);
    const folded = engine.forceFoldPlayer(stateRef.current, seat);
    const next = structuredClone(folded);
    next.players[seat].isHuman = false; // AI takes over from here on
    setState(next);
  }, []);

  // ─── Lobby seat editing (host only, table not yet started) ────────────────
  const addSeat = useCallback(() => setState(prev => engine.addAiSeat(prev)), []);
  const changeLobbyConfig = useCallback((next) => {
    setConfig(next);
    setState(prev => engine.applyConfig(prev, next));
  }, [setConfig]);

  // Removing a seat can shift every later seat's index down by one — the
  // connection maps below track guests by seat index, so they need to be
  // renumbered in lockstep with engine.removeSeat's re-indexing.
  const removeSeatAt = useCallback((seatIndex) => {
    if (seatIndex === HUMAN_ID) return;
    const kickedConn = connectionsRef.current.get(seatIndex);
    if (kickedConn) {
      kickedConn.send({ type: "kicked" });
      kickedConn.close();
    }
    const newConnections = new Map();
    const newConnToSeat = new Map();
    for (const [seat, conn] of connectionsRef.current) {
      if (seat === seatIndex) continue;
      const newSeat = seat > seatIndex ? seat - 1 : seat;
      newConnections.set(newSeat, conn);
      newConnToSeat.set(conn, newSeat);
    }
    connectionsRef.current = newConnections;
    connToSeatRef.current = newConnToSeat;
    setState(prev => engine.removeSeat(prev, seatIndex));
  }, []);

  // Host broadcasts its (redacted per-recipient) state after every change.
  useEffect(() => {
    if (role === "host") broadcastState(connectionsRef.current, state);
  }, [role, state]);

  // Only solo tables are saved — the host's state is shared with guests and a
  // client's is someone else's. Every multiplayer path starts from the menu,
  // which drops the solo save first.
  useEffect(() => {
    if (role !== "solo") return;
    if (view === "table") writePersisted(SOLO_SAVE_KEY, state);
    else removePersisted(SOLO_SAVE_KEY);
  }, [role, view, state]);

  // Host/client view follows state.handNumber — 0 means "lobby", >0 means "table".
  // Solo manages its own view transitions directly (no lobby stage at all).
  useEffect(() => {
    if (role === "solo") return;
    if (state.handNumber > 0 && view === "lobby") setView("table");
    if (state.handNumber === 0 && view === "table") setView("lobby");
  }, [state.handNumber, view, role]);

  // Table sounds: diff each state against the previous one. Runs for every
  // role — a guest's states arrive over the network but diff the same way.
  const soundPrevRef = useRef(null);
  useEffect(() => {
    const prev = soundPrevRef.current;
    soundPrevRef.current = state;
    if (soundOn && view === "table") playEvents(diffEvents(prev, state, mySeatId));
  }, [state, soundOn, view, mySeatId]);

  const myIdentity = () => ({
    name: identity.name.trim() || randomIdentity().name,
    avatar: identity.avatar,
  });

  // ─── Menu actions ───────────────────────────────────────────────────────────
  const playSolo = () => {
    setRole("solo"); setMySeatId(HUMAN_ID);
    setState(engine.startHand(engine.createInitialState(seatCount, config, myIdentity())));
    setView("table");
  };

  const hostGame = async () => {
    setStatusMsg("Starting room…");
    try {
      setState(engine.createInitialState(seatCount, config, myIdentity()));
      const { peer, roomId: newRoomId } = await hostRoom({
        onJoin: handleGuestJoin, onAction: handleGuestAction, onLeave: handleGuestLeave,
      });
      peerRef.current = peer;
      setRoomId(newRoomId);
      setRole("host"); setMySeatId(HUMAN_ID);
      setView("lobby"); setStatusMsg("");
      if (discoverable) {
        registerOpenRoom(newRoomId, "poker");
        roomHeartbeatRef.current = setInterval(() => registerOpenRoom(newRoomId, "poker"), ROOM_HEARTBEAT_MS);
      }
    } catch (e) {
      setStatusMsg("Error: " + e.message);
    }
  };

  const joinGame = async (codeOverride) => {
    const code = (codeOverride ?? joinInput).trim().toUpperCase();
    if (!code) return;
    setStatusMsg("Connecting…");
    try {
      const { peer, conn } = await joinRoomAsClient(code, myIdentity(), {
        onMessage: (msg) => {
          if (msg.type === "welcome") {
            // A late joiner (host already dealt hands) lands straight on the
            // table instead of flashing through the lobby first.
            setMySeatId(msg.seatId); setRoomId(code); setState(msg.state); setRole("client");
            setView(msg.state.handNumber > 0 ? "table" : "lobby");
            setStatusMsg("");
          }
          else if (msg.type === "state") setState(msg.state);
          else if (msg.type === "full") setStatusMsg("That room is full.");
          else if (msg.type === "kicked") {
            suppressCloseMsgRef.current = true;
            setStatusMsg("The host removed you from the table.");
            teardownNetwork(); setRole("solo"); setView("menu");
          }
        },
        onClose: () => {
          if (suppressCloseMsgRef.current) { suppressCloseMsgRef.current = false; return; }
          setStatusMsg("Disconnected from host."); teardownNetwork(); setRole("solo"); setView("menu");
        },
      });
      peerRef.current = peer;
      clientConnRef.current = conn;
    } catch (e) {
      setStatusMsg("Error: " + e.message);
    }
  };

  // Also the solo "Quit": back to the menu with a fresh state, which drops the
  // solo save (see the persistence effect above).
  const leaveGame = () => {
    // Our own close of the host connection isn't a "Disconnected" event.
    if (clientConnRef.current) suppressCloseMsgRef.current = true;
    teardownNetwork();
    setConfirming(null);
    setRole("solo"); setMySeatId(HUMAN_ID); setRoomId("");
    setMultiplayerMode(null); setStatusMsg("");
    setState(engine.createInitialState());
    setView("menu");
  };

  const refreshOpenRooms = useCallback(async () => {
    setRoomsLoading(true);
    setOpenRooms(await fetchOpenRooms("poker"));
    setRoomsLoading(false);
  }, []);
  useEffect(() => { if (view === "menu") refreshOpenRooms(); }, [view, refreshOpenRooms]);

  // Auto-join when opened via a shared link (/games/poker?room=XXXXXX) — code
  // is pre-filled, but a name is still required so the user confirms with Join.
  useEffect(() => {
    if (autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) { setMultiplayerMode("join"); setJoinInput(room.toUpperCase()); }
  }, []);

  // ─── Table derived values ──────────────────────────────────────────────────
  const cfg = engine.getConfig(state);
  const me = state.players[mySeatId];
  const toCall = state.currentBet - (me?.streetBet ?? 0);
  const isMyTurn = isSeatsTurn(state, mySeatId);

  const [raiseAmount, setRaiseAmount] = useState(cfg.bigBlind);

  // Beginner odds helper (all modes): only the viewer's own hole cards and
  // the board feed it, so it reveals nothing a client couldn't already see.
  const [showOddsBadge, setShowOddsBadge] = usePersistentState("game:poker:showOdds", true);
  const [oddsOpen, setOddsOpen] = useState(false);
  const closeOdds = useCallback(() => setOddsOpen(false), []);
  const handLive = state.street !== "waiting" && state.street !== "handOver";
  const myHole = handLive && me?.inHand && !me.folded ? me.holeCards : [];
  const liveOpponents = state.players.filter(p => p.id !== mySeatId && p.inHand && !p.folded).length;
  const odds = useOdds(myHole, state.board, liveOpponents);

  const minRaiseTarget = state.currentBet === 0
    ? Math.min(me?.stack ?? 0, cfg.bigBlind)
    : Math.min((me?.stack ?? 0) + (me?.streetBet ?? 0), state.currentBet + state.minRaise);
  const maxRaiseTarget = (me?.stack ?? 0) + (me?.streetBet ?? 0);
  const canRaise = isMyTurn && me && engine.legalActions(state, me).some(a => a === "bet" || a === "raise");

  useEffect(() => {
    if (isMyTurn) setRaiseAmount(Math.min(Math.max(minRaiseTarget, cfg.bigBlind), maxRaiseTarget));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, state.actingIndex, state.street]);

  // Drives bots and street transitions purely off state changes — host/solo
  // only. A client never calls engine.js itself; its state is network-driven.
  useEffect(() => {
    if (role === "client") return;
    if (state.street === "waiting" || state.street === "handOver") return;

    if (state.actingIndex === -1 || engine.isBettingRoundOver(state)) {
      const t = setTimeout(() => setState(prev => engine.advanceStreet(prev)), 900);
      return () => clearTimeout(t);
    }

    const player = state.players[state.actingIndex];
    if (!player.isHuman) {
      const t = setTimeout(() => {
        const decision = decideAction(state, player);
        setState(prev => engine.applyAction(prev, player.id, decision.type, decision.amount));
      }, 650 + Math.random() * 700);
      return () => clearTimeout(t);
    }
    if (role === "host" && player.id !== mySeatId) {
      // A remote guest's turn. The clean "Leave Table" path already
      // force-folds instantly via handleGuestLeave — this is the safety net
      // for a connection that dies silently (WebRTC/PeerJS's ICE-based close
      // detection can be slow, or never fire at all) or someone just AFK, so
      // a dead seat can't stall the table forever either way.
      const t = setTimeout(() => {
        setState(prev => engine.forceFoldPlayer(prev, player.id));
      }, 45000);
      return () => clearTimeout(t);
    }
  }, [state, role, mySeatId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.log]);

  // Decided only once a hand is over — during an all-in run-out every stack
  // can be 0 before the pot is paid out.
  const tableDecided = engine.isTableDecided(state);
  const meBusted = !!me && me.stack === 0 && (state.street === "handOver" || !me.inHand);
  const iCanRebuy = engine.canRebuy(state, me);
  const myRebuysLeft = me ? engine.rebuysLeft(state, me) : 0;
  const gameOver = tableDecided && !iCanRebuy;

  const canDealNext = state.street === "handOver" && !tableDecided;
  const revealShowdown = state.street === "handOver" && state.result && !state.result.unopposed;
  const winnerIds = new Set((state.result?.winners ?? []).map(w => w.playerId));

  const act = (type, amount) => {
    if (role === "client") clientConnRef.current?.send({ type: "action", actionType: type, amount });
    else setState(prev => engine.applyAction(prev, mySeatId, type, amount));
  };

  const doRebuy = () => {
    if (role === "client") clientConnRef.current?.send({ type: "rebuy" });
    else setState(prev => engine.rebuy(prev, mySeatId));
  };

  const dealNextHand = () => setState(prev => engine.startHand(prev));
  const restart = () => {
    if (role === "solo") { setState(engine.createInitialState()); setView("menu"); return; }
    setState(prev => resetForRematch(prev)); // host: keep the room/guests, go back to lobby
  };

  const potOrCurrent = Math.max(state.pot, cfg.bigBlind);
  const presets = [
    { label: "½ Pot", value: Math.round(state.currentBet + potOrCurrent * 0.5) },
    { label: "Pot", value: Math.round(state.currentBet + potOrCurrent) },
    { label: "All-in", value: maxRaiseTarget },
  ];

  // Rotated so the viewer's own seat is always at the bottom, like Chess
  // flipping the board for Black. Display-only — seat ids are untouched.
  const n = state.players.length;
  const slots = generateSeatPositions(n);
  const seatPosition = i => slots[(i - mySeatId + n) % n];

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(null), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  // Header buttons need two taps (within 3s) so a stray click can't throw a game away.
  const confirmThen = (key, fn) => () => {
    if (confirming === key) { setConfirming(null); fn(); } else setConfirming(key);
  };
  const armed = key => (confirming === key ? "bg-red-700 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-600");

  // ─── Views ──────────────────────────────────────────────────────────────────

  // The table view gets its own compact, height-bounded layout: a one-line
  // header, the felt taking exactly whatever height is left, and the action
  // bar under it — so Fold/Call/Raise never need a scroll. The felt sizes
  // itself with container-query units against that leftover box, so it
  // shrinks on short desktop windows instead of keeping a fixed 4:3 height.
  if (view === "table") {
    const btn = "px-4 py-1.5 sm:py-2 rounded-full text-sm sm:text-base font-semibold transition-colors";
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-white">
        <style>{globalStyles}</style>

        {/* pt-14 keeps this clear of Games.jsx's fixed "← Back" button
            (top-4 left-4) on narrow screens; sm+ has room to spare already. */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-14 sm:pt-3 pb-1 sm:pl-32">
          <div className="min-w-0 flex items-baseline gap-1.5 text-xs sm:text-sm text-slate-300">
            <span className="font-bold text-white whitespace-nowrap">🃏 Poker</span>
            <span className="text-slate-600">·</span>
            <span className="truncate">Hand #{state.handNumber} · Blinds ${cfg.smallBlind}/${cfg.bigBlind}</span>
          </div>
          <button
            onClick={() => setSoundOn(v => !v)}
            className="shrink-0 ml-auto w-8 h-7 rounded-full bg-slate-700 hover:bg-slate-600 text-xs transition-colors"
            title={soundOn ? "Mute table sounds" : "Unmute table sounds"}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            onClick={() => setOddsOpen(true)}
            className="shrink-0 px-3 py-1 rounded-full bg-emerald-800 hover:bg-emerald-700 text-xs transition-colors"
            title="Your chances, pot odds and hand rankings"
          >
            📊 Odds
          </button>
          {role === "host" && (
            <button
              onClick={confirmThen("restart", restart)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${armed("restart")}`}
              title="Start over: back to the lobby with the same room and players"
            >
              {confirming === "restart" ? "Sure?" : "Restart"}
            </button>
          )}
          <button
            onClick={confirmThen("quit", leaveGame)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${armed("quit")}`}
            title={role === "solo" ? "Quit this game and return to the menu" : "Leave the room"}
          >
            {confirming === "quit" ? "Sure?" : role === "solo" ? "Quit" : "Leave"}
          </button>
        </div>

        <div className="relative flex-1 min-h-[220px] w-full px-2" style={{ containerType: "size" }}>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: "min(100cqw, 820px, 165cqh)", height: "min(100cqh, 115cqw)" }}
          >
            <div className="absolute inset-x-[7%] inset-y-[11%] rounded-[50%] bg-gradient-radial-felt border-[8px] sm:border-[10px] border-[#5b3a1e] shadow-2xl" />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4">
              <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">
                {state.street === "handOver" ? "Hand Over" : state.street}
              </div>
              <div className="flex justify-center gap-1 sm:gap-1.5 min-h-[38px] sm:min-h-[52px]">
                {state.board.map((c, i) => <Card key={i} card={c} size="seat" />)}
                {state.board.length === 0 && <span className="text-emerald-100/40 text-xs self-center">— pre-flop —</span>}
              </div>
              <div className="px-3 py-0.5 rounded-full bg-black/40 border border-emerald-400/30 text-emerald-300 font-mono text-sm">
                Pot: ${state.pot}
              </div>
              {revealShowdown && (
                <div className="text-[10px] sm:text-[11px] text-amber-300 text-center max-w-[220px] leading-tight">
                  {Object.entries(state.result.hands).map(([id, hand]) => (
                    <div key={id}>{state.players.find(p => p.id === Number(id)).name}: {describeHand(hand)}</div>
                  ))}
                </div>
              )}
            </div>

            {state.players.map((p, i) => (
              <Seat
                key={p.id}
                player={p}
                isDealer={i === state.dealerIndex}
                isActing={i === state.actingIndex && handLive}
                showFace={p.id === mySeatId || (revealShowdown && !p.folded)}
                isWinner={winnerIds.has(p.id)}
                isMe={p.id === mySeatId}
                position={seatPosition(i)}
              />
            ))}
          </div>
        </div>

        {/* Bottom controls — one compact block; on sm+ the action buttons,
            slider and presets share a single row. */}
        <div className="shrink-0 px-3 pb-3 pt-1 max-w-3xl w-full mx-auto">
          {showOddsBadge && myHole.length === 2 && liveOpponents > 0 && (
            <OddsBadge hole={myHole} board={state.board} odds={odds} opponents={liveOpponents} onOpen={() => setOddsOpen(true)} />
          )}

          {isMyTurn && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-2 shadow-lg flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <button onClick={() => act("fold")} className={`${btn} bg-red-700 hover:bg-red-600`}>Fold</button>
              <button onClick={() => act(toCall > 0 ? "call" : "check")} className={`${btn} bg-slate-600 hover:bg-slate-500`}>
                {toCall > 0 ? `Call $${Math.min(toCall, me.stack)}` : "Check"}
              </button>
              {canRaise && (
                <>
                  <button onClick={() => act(state.currentBet === 0 ? "bet" : "raise", raiseAmount)} className={`${btn} bg-emerald-700 hover:bg-emerald-600`}>
                    {raiseAmount >= maxRaiseTarget ? "All-in"
                      : state.currentBet === 0 ? `Bet $${raiseAmount}` : `Raise to $${raiseAmount}`}
                  </button>
                  <div className="flex items-center gap-1.5 sm:gap-2 basis-full sm:basis-auto justify-center">
                    {/* Slider floors at whichever is smaller: the formal min-raise, or the
                        player's whole stack — a short stack can still shove all-in even
                        when that's below a full min-raise (engine.js allows this). */}
                    <input
                      type="range" min={Math.min(minRaiseTarget, maxRaiseTarget)} max={Math.max(maxRaiseTarget, minRaiseTarget)} value={raiseAmount}
                      onChange={e => setRaiseAmount(Number(e.target.value))}
                      className="poker-slider w-32 sm:w-36"
                    />
                    {presets.map(p => (
                      <button key={p.label}
                        onClick={() => setRaiseAmount(Math.max(minRaiseTarget, Math.min(maxRaiseTarget, p.value)))}
                        className="px-2.5 py-1 text-[11px] sm:text-xs rounded-full bg-slate-700 hover:bg-slate-600 transition-colors">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {iCanRebuy && (
            <div className="text-center bg-slate-800 rounded-2xl p-3 border border-amber-500/60 shadow-lg mb-2">
              <p className="text-sm sm:text-base font-semibold mb-2">😵 You&apos;re out of chips.</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <button onClick={doRebuy} className={`${btn} bg-amber-600 hover:bg-amber-500`}>
                  Re-buy ${cfg.startingStack}
                  <span className="text-xs font-normal opacity-80"> · {myRebuysLeft === Infinity ? "unlimited" : `${myRebuysLeft} left`}</span>
                </button>
                {tableDecided && role !== "client" && (
                  <button onClick={restart} className={`${btn} bg-slate-600 hover:bg-slate-500`}>
                    {role === "host" ? "Rematch" : "New game"}
                  </button>
                )}
              </div>
            </div>
          )}

          {canDealNext && role !== "client" && (
            <div className="text-center">
              <button onClick={dealNextHand} className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-lg transition-colors">
                Next Hand
              </button>
            </div>
          )}
          {canDealNext && role === "client" && (
            <p className="text-center text-slate-500 text-sm">Waiting for the host to deal the next hand…</p>
          )}

          {gameOver && (
            <div className="text-center bg-slate-800 rounded-2xl p-3 sm:p-5 border border-amber-500 shadow-xl">
              <p className="text-lg sm:text-xl font-bold mb-2">{meBusted ? "😵 You're out of chips." : "🏆 You won the table!"}</p>
              {role !== "client" ? (
                <button onClick={restart} className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">
                  {role === "host" ? "Rematch" : "Restart"}
                </button>
              ) : (
                <p className="text-slate-400 text-sm">Waiting for the host to start a rematch…</p>
              )}
            </div>
          )}
        </div>

        {oddsOpen && (
          <OddsModal
            hole={myHole}
            board={state.board}
            odds={odds}
            opponents={liveOpponents}
            toCall={Math.max(0, Math.min(toCall, me?.stack ?? 0))}
            pot={state.pot}
            showBadge={showOddsBadge}
            onToggleBadge={setShowOddsBadge}
            onClose={closeOdds}
          />
        )}
      </div>
    );
  }

  return (
    // Games.jsx overlays a fixed "← Back" button at top-4 left-4 — extra top
    // padding on mobile keeps the centered title clear of it (there's more
    // natural clearance on wider layouts already).
    <div className="min-h-full bg-gradient-to-b from-slate-950 to-slate-900 px-4 pt-16 pb-4 md:p-8 text-white">
      <style>{globalStyles}</style>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-1 tracking-tight">🃏 Poker</h1>
        <p className="text-center text-slate-400 text-sm mb-6">
          Texas Hold&apos;em · No-Limit · {engine.describeConfig(view === "menu" ? config : state.config)}
        </p>

        {view === "menu" && (
          <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl max-w-md mx-auto">
            <IdentityPicker identity={identity} onChange={setIdentity} />

            {multiplayerMode !== "join" && (
              <TableSettings config={config} onChange={setConfig} seatCount={seatCount} onSeatCount={setSeatCount} />
            )}

            <button onClick={playSolo} className="w-full px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-lg transition-colors mb-5">
              🤖 Play Solo vs {seatCount - 1} AI
            </button>

            <div className="flex items-center gap-3 text-slate-500 text-xs mb-5">
              <div className="flex-1 h-px bg-slate-700" /> or play with friends <div className="flex-1 h-px bg-slate-700" />
            </div>

            {!multiplayerMode && (
              <div className="flex gap-2 mb-5">
                <button onClick={() => setMultiplayerMode("host")} className="flex-1 px-4 py-2 rounded-full bg-slate-700 hover:bg-slate-600 font-semibold transition-colors">
                  🌐 Host a Room
                </button>
                <button onClick={() => setMultiplayerMode("join")} className="flex-1 px-4 py-2 rounded-full bg-slate-700 hover:bg-slate-600 font-semibold transition-colors">
                  🔗 Join a Room
                </button>
              </div>
            )}

            {multiplayerMode === "host" && (
              <div className="flex flex-col gap-2 mb-5">
                <p className="text-xs text-slate-400">
                  Uses the settings above. Seats nobody claims are played by AI.
                </p>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={discoverable} onChange={e => setDiscoverable(e.target.checked)} />
                  List this room publicly so others can find it below
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setMultiplayerMode(null)} className="px-4 py-2 rounded-full bg-slate-700 hover:bg-slate-600 text-sm transition-colors">Back</button>
                  <button onClick={hostGame} className="flex-1 px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-600 font-semibold transition-colors">Create Room</button>
                </div>
              </div>
            )}

            {multiplayerMode === "join" && (
              <div className="flex flex-col gap-2 mb-5">
                <input placeholder="Room code (e.g. AB12CD)" value={joinInput}
                  onChange={e => setJoinInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && joinGame()}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm outline-none focus:border-indigo-500" />
                <div className="flex gap-2">
                  <button onClick={() => setMultiplayerMode(null)} className="px-4 py-2 rounded-full bg-slate-700 hover:bg-slate-600 text-sm transition-colors">Back</button>
                  <button onClick={() => joinGame()} className="flex-1 px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-600 font-semibold transition-colors">Join</button>
                </div>
              </div>
            )}

            {statusMsg && <p className="text-amber-300 text-sm text-center mb-4">{statusMsg}</p>}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">Open rooms — tap to join:</p>
                <button onClick={refreshOpenRooms} disabled={roomsLoading} className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 text-xs transition-colors">
                  {roomsLoading ? "…" : "⟳"}
                </button>
              </div>
              {openRooms.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {openRooms.map(r => (
                    <button key={r.roomId} onClick={() => { setMultiplayerMode("join"); setJoinInput(r.roomId); }}
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-500 text-sm text-left transition-colors">
                      {r.roomId} <span className="text-slate-500 text-xs">· waiting</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 text-xs">{roomsLoading ? "Checking…" : "None right now."}</p>
              )}
            </div>
          </div>
        )}

        {view === "lobby" && role === "host" && (
          <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl max-w-md mx-auto text-center">
            <h2 className="text-xl font-bold mb-1">Room ready</h2>
            <p className="text-slate-400 text-sm mb-4">Share the code, link, or QR — start whenever you&apos;re ready.</p>
            <div className="flex gap-3 items-center mb-4">
              <img src={buildQrUrl(buildShareLink(roomId), 180)} alt="Scan to join" width={104} height={104} className="rounded-lg bg-white p-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                  <code className="flex-1 text-lg tracking-widest text-indigo-300 font-mono text-left">{roomId}</code>
                  <CopyButton text={roomId} label="Code" />
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] text-slate-500 truncate text-left">{buildShareLink(roomId)}</code>
                  <CopyButton text={buildShareLink(roomId)} label="Link" />
                </div>
              </div>
            </div>

            <TableSettings config={state.config} onChange={changeLobbyConfig} />
            <SeatList players={state.players} mySeatId={mySeatId} onAdd={addSeat} onRemove={removeSeatAt} />

            <div className="flex gap-2">
              <button onClick={leaveGame} className="px-4 py-2 rounded-full bg-red-700 hover:bg-red-600 text-sm transition-colors">Cancel</button>
              <button onClick={dealNextHand} className="flex-1 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">Start Game</button>
            </div>
          </div>
        )}

        {view === "lobby" && role === "client" && (
          <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl max-w-md mx-auto text-center">
            <h2 className="text-xl font-bold mb-1">Connected!</h2>
            <p className="text-slate-400 text-sm mb-4">Waiting for the host to start…</p>
            <TableSettings config={state.config} readOnly />
            <SeatList players={state.players} mySeatId={mySeatId} />
            <button onClick={leaveGame} className="px-6 py-2 rounded-full bg-red-700 hover:bg-red-600 font-semibold transition-colors">Leave</button>
          </div>
        )}

        {/* view === "table" returns early above with its own layout. */}
      </div>
    </div>
  );
}

const globalStyles = `
.bg-gradient-radial-felt {
  background: radial-gradient(ellipse at center, #0f5f3d 0%, #0b4a30 60%, #083b26 100%);
}
.card-back {
  background: repeating-linear-gradient(45deg, #3730a3, #3730a3 4px, #4338ca 4px, #4338ca 8px);
  border: 2px solid #6366f1;
}
@keyframes dealIn {
  from { opacity: 0; transform: translateY(-10px) scale(0.85); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.card-deal { animation: dealIn 0.25s ease-out; }
@keyframes seatPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.55); }
  50%      { box-shadow: 0 0 0 6px rgba(251,191,36,0); }
}
.seat-active { animation: seatPulse 1.4s ease-in-out infinite; }
@keyframes winnerPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0.6); }
  50%      { box-shadow: 0 0 14px 4px rgba(250,204,21,0.5); }
}
.seat-winner { animation: winnerPulse 1.2s ease-in-out infinite; }
.poker-slider {
  -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px;
  background: linear-gradient(90deg, #10b981, #334155);
  outline: none;
}
.poker-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
  background: #fbbf24; border: 2px solid #92400e; cursor: pointer;
}
.poker-slider::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 50%;
  background: #fbbf24; border: 2px solid #92400e; cursor: pointer;
}
`;
