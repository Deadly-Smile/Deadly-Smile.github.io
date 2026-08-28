import { useState, useEffect, useRef, useCallback } from "react";
import * as engine from "./engine";
import { decideAction } from "./ai";
import { rankLabel, describeHand } from "./handEvaluator";
import { hostRoom, joinRoomAsClient, broadcastState, redactStateForSeat, nextOpenSeat } from "./multiplayer";
import { buildQrUrl, registerOpenRoom, unregisterOpenRoom, fetchOpenRooms } from "../../tools/tk-shared.jsx";

const HUMAN_ID = 0;
const RED_SUITS = new Set(["h", "d"]);
const SUIT_SYMBOL = { s: "♠", h: "♥", d: "♦", c: "♣" };
const ROOM_HEARTBEAT_MS = 20000;

// Six seats laid out clockwise around an oval, starting at the bottom (You).
// Fixed rather than computed — there are always exactly 6 players.
const SEAT_POS = [
  { top: "90%", left: "50%" },
  { top: "68%", left: "10%" },
  { top: "28%", left: "10%" },
  { top: "8%", left: "50%" },
  { top: "28%", left: "90%" },
  { top: "68%", left: "90%" },
];

function buildShareLink(roomId) {
  return `${window.location.origin}/games?game=poker&room=${roomId}`;
}

// Preserves which seats are guest-controlled (and their names) across a
// rematch — a host restarting shouldn't have to re-share the room.
function resetForRematch(prevState) {
  const fresh = engine.createInitialState();
  fresh.players = fresh.players.map((p, i) => {
    const prevPlayer = prevState.players[i];
    return i !== HUMAN_ID && prevPlayer?.isHuman ? { ...p, isHuman: true, name: prevPlayer.name } : p;
  });
  fresh.players[HUMAN_ID].name = prevState.players[HUMAN_ID].name;
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
  const dims = size === "lg" ? "w-12 h-[68px] text-base" : "w-9 h-[52px] text-xs";
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

function Seat({ player, isDealer, isActing, showFace, isWinner, position }) {
  const busted = player.stack === 0 && !player.inHand;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 w-24 sm:w-28"
      style={position}
    >
      {isDealer && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-yellow-300 text-black text-[10px] font-bold flex items-center justify-center shadow border border-yellow-500 z-10">D</div>
      )}
      <div
        className={[
          "rounded-xl border-2 px-2 py-2 flex flex-col items-center gap-1 bg-slate-800/90 backdrop-blur-sm w-full",
          isWinner ? "border-yellow-400 seat-winner" : isActing ? "border-amber-400 seat-active" : "border-slate-700",
          player.folded || busted ? "opacity-35" : "",
        ].join(" ")}
      >
        <div className="text-[11px] sm:text-xs font-semibold text-white truncate w-full text-center">{player.name}</div>
        <div className="flex gap-1">
          {player.holeCards.length > 0
            ? player.holeCards.map((c, i) => <Card key={i} card={c} hidden={!showFace} />)
            : <Card hidden />}
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

export default function Poker() {
  const [state, setState] = useState(() => engine.createInitialState());
  const [view, setView] = useState("menu"); // menu | lobby | table
  const [role, setRole] = useState("solo"); // solo | host | client
  const [mySeatId, setMySeatId] = useState(HUMAN_ID);

  const [multiplayerMode, setMultiplayerMode] = useState(null); // null | "host" | "join"
  const [nameInput, setNameInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [roomId, setRoomId] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const logEndRef = useRef(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const peerRef = useRef(null);
  const connectionsRef = useRef(new Map());   // host: seatId -> DataConnection
  const connToSeatRef = useRef(new Map());    // host: DataConnection -> seatId
  const clientConnRef = useRef(null);         // client: its one connection to the host
  const roomHeartbeatRef = useRef(null);
  const autoJoinedRef = useRef(false);

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
  const handleGuestJoin = useCallback((conn, name) => {
    const seat = nextOpenSeat(connectionsRef.current);
    if (seat === -1) { conn.send({ type: "full" }); conn.close(); return; }
    connectionsRef.current.set(seat, conn);
    connToSeatRef.current.set(conn, seat);
    const next = structuredClone(stateRef.current);
    next.players[seat].isHuman = true;
    if (name) next.players[seat].name = name.slice(0, 16);
    conn.send({ type: "welcome", seatId: seat, state: redactStateForSeat(next, seat) });
    setState(next);
  }, []);

  const handleGuestAction = useCallback((conn, msg) => {
    const seat = connToSeatRef.current.get(conn);
    if (seat == null || msg?.type !== "action") return;
    setState(engine.applyAction(stateRef.current, seat, msg.actionType, msg.amount));
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

  // Host broadcasts its (redacted per-recipient) state after every change.
  useEffect(() => {
    if (role === "host") broadcastState(connectionsRef.current, state);
  }, [role, state]);

  // Host/client view follows state.handNumber — 0 means "lobby", >0 means "table".
  // Solo manages its own view transitions directly (no lobby stage at all).
  useEffect(() => {
    if (role === "solo") return;
    if (state.handNumber > 0 && view === "lobby") setView("table");
    if (state.handNumber === 0 && view === "table") setView("lobby");
  }, [state.handNumber, view, role]);

  // ─── Menu actions ───────────────────────────────────────────────────────────
  const playSolo = () => {
    setRole("solo"); setMySeatId(HUMAN_ID);
    setState(prev => engine.startHand(prev));
    setView("table");
  };

  const hostGame = async () => {
    setStatusMsg("Starting room…");
    try {
      const named = structuredClone(stateRef.current);
      named.players[HUMAN_ID].name = nameInput.trim() || "Host";
      setState(named);
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
      const { peer, conn } = await joinRoomAsClient(code, nameInput.trim() || "Guest", {
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
        },
        onClose: () => { setStatusMsg("Disconnected from host."); teardownNetwork(); setRole("solo"); setView("menu"); },
      });
      peerRef.current = peer;
      clientConnRef.current = conn;
    } catch (e) {
      setStatusMsg("Error: " + e.message);
    }
  };

  const leaveGame = () => {
    teardownNetwork();
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

  // Auto-join when opened via a shared link (?game=poker&room=XXXXXX) — code
  // is pre-filled, but a name is still required so the user confirms with Join.
  useEffect(() => {
    if (autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) { setMultiplayerMode("join"); setJoinInput(room.toUpperCase()); }
  }, []);

  // ─── Table derived values ──────────────────────────────────────────────────
  const me = state.players[mySeatId];
  const toCall = state.currentBet - (me?.streetBet ?? 0);
  const isMyTurn = state.street !== "waiting" && state.street !== "handOver"
    && state.actingIndex === mySeatId && !engine.isBettingRoundOver(state);

  const [raiseAmount, setRaiseAmount] = useState(engine.BIG_BLIND);

  const minRaiseTarget = state.currentBet === 0
    ? Math.min(me?.stack ?? 0, engine.BIG_BLIND)
    : Math.min((me?.stack ?? 0) + (me?.streetBet ?? 0), state.currentBet + state.minRaise);
  const maxRaiseTarget = (me?.stack ?? 0) + (me?.streetBet ?? 0);

  useEffect(() => {
    if (isMyTurn) setRaiseAmount(Math.min(Math.max(minRaiseTarget, engine.BIG_BLIND), maxRaiseTarget));
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

  const gameOver = engine.playersRemaining(state) === 1 && state.handNumber > 0;
  const meBusted = gameOver && me.stack === 0;

  const canDealNext = state.street === "handOver" && !gameOver;
  const revealShowdown = state.street === "handOver" && state.result && !state.result.unopposed;
  const winnerIds = new Set((state.result?.winners ?? []).map(w => w.playerId));

  const act = (type, amount) => {
    if (role === "client") clientConnRef.current?.send({ type: "action", actionType: type, amount });
    else setState(prev => engine.applyAction(prev, mySeatId, type, amount));
  };

  const dealNextHand = () => setState(prev => engine.startHand(prev));
  const restart = () => {
    if (role === "solo") { setState(engine.createInitialState()); setView("menu"); return; }
    setState(prev => resetForRematch(prev)); // host: keep the room/guests, go back to lobby
  };

  const potOrCurrent = Math.max(state.pot, engine.BIG_BLIND);
  const presets = [
    { label: "1/2 Pot", value: Math.round(state.currentBet + potOrCurrent * 0.5) },
    { label: "Pot", value: Math.round(state.currentBet + potOrCurrent) },
    { label: "All-in", value: maxRaiseTarget },
  ];

  // ─── Views ──────────────────────────────────────────────────────────────────

  return (
    // Games.jsx overlays a fixed "← Back" button at top-4 left-4 — extra top
    // padding on mobile keeps the centered title clear of it (there's more
    // natural clearance on wider layouts already).
    <div className="min-h-full bg-gradient-to-b from-slate-950 to-slate-900 px-4 pt-16 pb-4 md:p-8 text-white">
      <style>{globalStyles}</style>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-1 tracking-tight">🃏 Texas Hold'em</h1>
        <p className="text-center text-slate-400 text-sm mb-6">
          No-Limit · blinds ${engine.SMALL_BLIND}/${engine.BIG_BLIND}
        </p>

        {view === "menu" && (
          <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl max-w-md mx-auto">
            <button onClick={playSolo} className="w-full px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-lg transition-colors mb-5">
              🤖 Play Solo vs 5 AI
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
                <input placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm outline-none focus:border-indigo-500" />
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
                <input placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm outline-none focus:border-indigo-500" />
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
            <p className="text-slate-400 text-sm mb-4">Share the code, link, or QR — start whenever you're ready.</p>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-3">
              <code className="flex-1 text-xl tracking-widest text-indigo-300 font-mono">{roomId}</code>
              <CopyButton text={roomId} label="Copy Code" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 text-[11px] text-slate-500 truncate text-left">{buildShareLink(roomId)}</code>
              <CopyButton text={buildShareLink(roomId)} label="Copy Link" />
            </div>
            <img src={buildQrUrl(buildShareLink(roomId), 180)} alt="Scan to join" width={160} height={160} className="mx-auto rounded-lg mb-4 bg-white p-2" />

            <div className="text-left bg-slate-900 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-400 mb-2">Players</p>
              <ul className="space-y-1 text-sm">
                {state.players.map((p, i) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className={p.isHuman || i === HUMAN_ID ? "text-emerald-400" : "text-slate-500"}>
                      {i === HUMAN_ID ? "You (host)" : p.isHuman ? "✅ connected" : "🤖 AI"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2">
              <button onClick={leaveGame} className="px-4 py-2 rounded-full bg-red-700 hover:bg-red-600 text-sm transition-colors">Cancel</button>
              <button onClick={dealNextHand} className="flex-1 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">Start Game</button>
            </div>
          </div>
        )}

        {view === "lobby" && role === "client" && (
          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl max-w-md mx-auto text-center">
            <h2 className="text-xl font-bold mb-2">Connected!</h2>
            <p className="text-slate-400 text-sm mb-6">You're seat {mySeatId + 1} — waiting for the host to start…</p>
            <button onClick={leaveGame} className="px-6 py-2 rounded-full bg-red-700 hover:bg-red-600 font-semibold transition-colors">Leave</button>
          </div>
        )}

        {view === "table" && (
          <>
            {/* Fixed height on mobile — an aspect-ratio box gets too short at narrow
                widths for the hexagon seat layout below to fit without overlapping
                the centered board; sm+ switches to real aspect-ratio scaling. */}
            <div className="relative w-full max-w-3xl mx-auto mb-5 h-[560px] sm:h-auto sm:aspect-[4/3]">
              <div className="absolute inset-[6%] rounded-[50%] bg-gradient-radial-felt border-[10px] border-[#5b3a1e] shadow-2xl" />

              {/* Board + pot, centered on the felt */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
                <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">
                  {state.street === "handOver" ? "Hand Over" : state.street}
                </div>
                <div className="flex justify-center gap-1.5 min-h-[52px]">
                  {state.board.map((c, i) => <Card key={i} card={c} />)}
                  {state.board.length === 0 && <span className="text-emerald-100/40 text-xs self-center">— pre-flop —</span>}
                </div>
                <div className="px-3 py-1 rounded-full bg-black/40 border border-emerald-400/30 text-emerald-300 font-mono text-sm">
                  Pot: ${state.pot}
                </div>
                {revealShowdown && (
                  <div className="mt-1 text-[11px] text-amber-300 text-center max-w-[220px]">
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
                  isActing={i === state.actingIndex && state.street !== "handOver" && state.street !== "waiting"}
                  showFace={p.id === mySeatId || revealShowdown}
                  isWinner={winnerIds.has(p.id)}
                  position={SEAT_POS[i]}
                />
              ))}
            </div>

            {isMyTurn && (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 mb-4 shadow-lg">
                <div className="flex flex-wrap gap-2 justify-center mb-3">
                  <button onClick={() => act("fold")} className="px-5 py-2 rounded-full bg-red-700 hover:bg-red-600 font-semibold transition-colors">Fold</button>
                  <button onClick={() => act(toCall > 0 ? "call" : "check")} className="px-5 py-2 rounded-full bg-slate-600 hover:bg-slate-500 font-semibold transition-colors">
                    {toCall > 0 ? `Call $${Math.min(toCall, me.stack)}` : "Check"}
                  </button>
                  <button
                    onClick={() => act(state.currentBet === 0 ? "bet" : "raise", raiseAmount)}
                    className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-600 font-semibold transition-colors"
                  >
                    {raiseAmount >= maxRaiseTarget ? "All-in"
                      : state.currentBet === 0 ? `Bet $${raiseAmount}` : `Raise to $${raiseAmount}`}
                  </button>
                </div>
                <div className="flex items-center gap-3 justify-center flex-wrap">
                  {/* Slider floors at whichever is smaller: the formal min-raise, or the
                      player's whole stack — a short stack can still shove all-in even
                      when that's below a full min-raise (engine.js allows this). */}
                  <input
                    type="range" min={Math.min(minRaiseTarget, maxRaiseTarget)} max={Math.max(maxRaiseTarget, minRaiseTarget)} value={raiseAmount}
                    onChange={e => setRaiseAmount(Number(e.target.value))}
                    className="poker-slider w-48"
                  />
                  {presets.map(p => (
                    <button key={p.label}
                      onClick={() => setRaiseAmount(Math.max(minRaiseTarget, Math.min(maxRaiseTarget, p.value)))}
                      className="px-3 py-1 text-xs rounded-full bg-slate-700 hover:bg-slate-600 transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {canDealNext && role !== "client" && (
              <div className="text-center mb-4">
                <button onClick={dealNextHand} className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-lg transition-colors">
                  Next Hand
                </button>
              </div>
            )}
            {canDealNext && role === "client" && (
              <p className="text-center text-slate-500 text-sm mb-4">Waiting for the host to deal the next hand…</p>
            )}

            {gameOver && role !== "client" && (
              <div className="text-center mb-4 bg-slate-800 rounded-2xl p-6 border border-amber-500 shadow-xl">
                <p className="text-xl font-bold mb-3">
                  {meBusted ? "😵 You're out of chips." : "🏆 You won the table!"}
                </p>
                <button onClick={restart} className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">
                  {role === "host" ? "Rematch" : "Restart"}
                </button>
              </div>
            )}
            {gameOver && role === "client" && (
              <div className="text-center mb-4 bg-slate-800 rounded-2xl p-6 border border-amber-500 shadow-xl">
                <p className="text-xl font-bold">{meBusted ? "😵 You're out of chips." : "🏆 You won the table!"}</p>
                <p className="text-slate-400 text-sm mt-2">Waiting for the host to start a rematch…</p>
              </div>
            )}

            {role !== "solo" && (
              <div className="text-center mb-3">
                <button onClick={leaveGame} className="px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-xs transition-colors">Leave Table</button>
              </div>
            )}

            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3 max-h-36 overflow-y-auto text-xs text-slate-300 space-y-1 font-mono">
              {state.log.map((line, i) => <div key={i}>{line}</div>)}
              <div ref={logEndRef} />
            </div>
          </>
        )}
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
