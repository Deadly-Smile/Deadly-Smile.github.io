import { useState, useEffect, useCallback, useRef } from "react";
import * as engine from "./engine";
import {
  hostSimpleRoom, joinSimpleRoom, buildQrUrl,
  registerOpenRoom, unregisterOpenRoom, fetchOpenRooms,
} from "../../tools/tk-shared.jsx";

const ROOM_HEARTBEAT_MS = 20000;
function buildShareLink(roomId) {
  return `${window.location.origin}/games?game=battleship&room=${roomId}`;
}

// ─── Small shared bits ───────────────────────────────────────────────────────

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

function Stepper({ value, onChange, min, max, label }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(value - 1)} disabled={value <= min}
          className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-colors">−</button>
        <span className="w-6 text-center font-mono font-semibold text-white">{value}</span>
        <button onClick={() => onChange(value + 1)} disabled={value >= max}
          className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-colors">+</button>
      </div>
    </div>
  );
}

// Board-size + fleet editor — shared by the pre-host menu and the host's
// lobby (host can keep tuning it right up until Start Game, mirroring
// Poker's adjustable-seats-in-lobby pattern).
function FleetConfigEditor({ boardSize, ships, onBoardSizeChange, onShipsChange }) {
  return (
    <div className="mb-4 text-left">
      <Stepper label="Board size" value={boardSize} min={engine.MIN_BOARD_SIZE} max={engine.MAX_BOARD_SIZE}
        onChange={n => onBoardSizeChange(engine.clampBoardSize(n))} />
      <div className="mt-2 flex flex-col gap-1.5">
        {ships.map((len, i) => (
          <div key={i} className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
            <span className="text-xs text-slate-400">Ship {i + 1}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => onShipsChange(ships.map((l, idx) => idx === i ? engine.clampShipLen(l - 1, boardSize) : l))}
                disabled={len <= engine.MIN_SHIP_LEN} className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-xs font-bold">−</button>
              <span className="w-4 text-center font-mono text-sm">{len}</span>
              <button onClick={() => onShipsChange(ships.map((l, idx) => idx === i ? engine.clampShipLen(l + 1, boardSize) : l))}
                disabled={len >= Math.min(engine.MAX_SHIP_LEN, boardSize)} className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-xs font-bold">+</button>
              <button onClick={() => onShipsChange(ships.length > engine.MIN_SHIP_COUNT ? ships.filter((_, idx) => idx !== i) : ships)}
                disabled={ships.length <= engine.MIN_SHIP_COUNT} className="w-6 h-6 rounded-full bg-red-800/60 hover:bg-red-700 disabled:opacity-20 text-[11px]">✕</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onShipsChange(ships.length < engine.MAX_SHIP_COUNT ? [...ships, engine.MIN_SHIP_LEN] : ships)}
        disabled={ships.length >= engine.MAX_SHIP_COUNT}
        className="mt-2 w-full px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-xs font-semibold transition-colors">
        + Add ship
      </button>
      {!engine.fleetFitsBoard(ships, boardSize) && (
        <p className="text-amber-400 text-xs mt-2">That fleet is dense for this board — placement may be tricky. Consider a bigger board or fewer/shorter ships.</p>
      )}
    </div>
  );
}

// Generic size×size click grid — used for both placement and battle boards.
function BoardGrid({ size, onCellClick, onCellHover, onCellLeave, cellClass, cellContent, disabled }) {
  return (
    <div
      className="inline-grid gap-[2px] bg-slate-950 p-1 rounded-lg touch-manipulation"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}
      onMouseLeave={onCellLeave}
    >
      {Array.from({ length: size * size }, (_, idx) => {
        const x = idx % size, y = Math.floor(idx / size);
        return (
          <button
            key={idx}
            disabled={disabled}
            onClick={() => onCellClick?.(x, y)}
            onMouseEnter={() => onCellHover?.(x, y)}
            className={`aspect-square w-5 sm:w-7 flex items-center justify-center text-[10px] sm:text-xs rounded-[3px] transition-colors ${cellClass ? cellClass(x, y) : "bg-blue-900/40"}`}
          >
            {cellContent?.(x, y)}
          </button>
        );
      })}
    </div>
  );
}

// ─── Root component ──────────────────────────────────────────────────────────

export default function Battleship() {
  const [view, setView] = useState("menu"); // menu | lobby | placement | battle
  const [role, setRole] = useState(null);   // host | guest
  const [nameInput, setNameInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [roomId, setRoomId] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [disconnected, setDisconnected] = useState(false);

  // Host-editable match config — dynamic board size and fleet, within limits.
  const [boardSize, setBoardSize] = useState(engine.DEFAULT_BOARD_SIZE);
  const [ships, setShips] = useState(() => engine.defaultFleetFor(engine.DEFAULT_BOARD_SIZE));

  // Placement phase
  const [placedShips, setPlacedShips] = useState(() => Array(ships.length).fill(null));
  const [activeShipIndex, setActiveShipIndex] = useState(0);
  const [orientation, setOrientation] = useState("h");
  const [hoverCell, setHoverCell] = useState(null);
  const [placementReady, setPlacementReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

  // Battle phase
  const [myGoesFirst, setMyGoesFirst] = useState(true);
  const [myTurn, setMyTurn] = useState(false);
  const [shotsFired, setShotsFired] = useState([]);   // my shots on enemy waters: {x,y,hit,sunk}
  const [myBoardShots, setMyBoardShots] = useState([]); // opponent's shots on my board: {x,y,hit}
  const [gameOverState, setGameOverState] = useState(null); // {won, reason: "sunk"|"resign"|"disconnect"}

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const roomHeartbeatRef = useRef(null);
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const placedShipsRef = useRef(placedShips);
  useEffect(() => { placedShipsRef.current = placedShips; }, [placedShips]);
  const hostGoesFirstToggleRef = useRef(true);
  const autoJoinedRef = useRef(false);

  const teardownNetwork = useCallback(() => {
    clearInterval(roomHeartbeatRef.current);
    roomHeartbeatRef.current = null;
    if (roomIdRef.current) unregisterOpenRoom(roomIdRef.current);
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
  }, []);
  useEffect(() => teardownNetwork, [teardownNetwork]);

  const resetForNewMatch = useCallback((newBoardSize, newShips) => {
    setPlacedShips(Array(newShips.length).fill(null));
    setActiveShipIndex(0);
    setOrientation("h");
    setHoverCell(null);
    setPlacementReady(false);
    setOpponentReady(false);
    setShotsFired([]);
    setMyBoardShots([]);
    setGameOverState(null);
    setMyTurn(false);
  }, []);

  // ─── Networking ─────────────────────────────────────────────────────────
  const wireConn = useCallback((conn, oppName, isHostSide) => {
    connRef.current = conn;
    setOpponentName(oppName);
    setDisconnected(false);

    conn.on("data", (msg) => {
      if (msg.type === "config") {
        setBoardSize(msg.boardSize); setShips(msg.ships);
        resetForNewMatch(msg.boardSize, msg.ships);
      } else if (msg.type === "start") {
        setBoardSize(msg.boardSize); setShips(msg.ships);
        if (!isHostSide) setMyGoesFirst(!msg.hostGoesFirst);
        resetForNewMatch(msg.boardSize, msg.ships);
        setView("placement");
      } else if (msg.type === "ready") {
        setOpponentReady(true);
      } else if (msg.type === "fire") {
        const { ships: nextShips, hit, sunk, shipLen, gameOver } = engine.fireAt(placedShipsRef.current, msg.x, msg.y);
        setPlacedShips(nextShips);
        setMyBoardShots(prev => [...prev, { x: msg.x, y: msg.y, hit }]);
        conn.send({ type: "result", x: msg.x, y: msg.y, hit, sunk, shipLen, gameOver });
        if (gameOver) setGameOverState({ won: false, reason: "sunk" });
        else setMyTurn(true);
      } else if (msg.type === "result") {
        setShotsFired(prev => [...prev, { x: msg.x, y: msg.y, hit: msg.hit, sunk: msg.sunk }]);
        if (msg.gameOver) setGameOverState({ won: true, reason: "sunk" });
      } else if (msg.type === "resign") {
        setGameOverState(prev => prev ?? { won: true, reason: "resign" });
      } else if (msg.type === "rematch") {
        setBoardSize(msg.boardSize); setShips(msg.ships);
        if (!isHostSide) setMyGoesFirst(!msg.hostGoesFirst);
        resetForNewMatch(msg.boardSize, msg.ships);
        setView("placement");
      }
    });
    conn.on("close", () => {
      setDisconnected(true);
      if (viewRef.current === "battle") setGameOverState(prev => prev ?? { won: true, reason: "disconnect" });
    });
  }, [resetForNewMatch]);

  const refreshOpenRooms = useCallback(async () => {
    setRoomsLoading(true);
    setOpenRooms(await fetchOpenRooms("battleship"));
    setRoomsLoading(false);
  }, []);
  useEffect(() => { if (view === "menu") refreshOpenRooms(); }, [view, refreshOpenRooms]);

  const hostGame = async () => {
    setStatusMsg("Starting room…");
    try {
      const { peer, roomId: newRoomId } = await hostSimpleRoom({
        onJoin: (conn, name) => {
          conn.send({ type: "welcome", boardSize, ships, hostName: nameInput.trim() || "Host" });
          wireConn(conn, name || "Guest", true);
        },
        onAction: () => {}, // fleet/fire logic runs entirely peer-to-peer, no funnel needed
        onLeave: () => setDisconnected(true),
      });
      peerRef.current = peer;
      setRoomId(newRoomId);
      setRole("host");
      setView("lobby");
      setStatusMsg("");
      if (discoverable) {
        registerOpenRoom(newRoomId, "battleship");
        roomHeartbeatRef.current = setInterval(() => registerOpenRoom(newRoomId, "battleship"), ROOM_HEARTBEAT_MS);
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
      const { peer, conn } = await joinSimpleRoom(code, nameInput.trim() || "Guest", {
        onMessage: (msg) => {
          if (msg.type === "welcome") {
            setRoomId(code); setRole("guest");
            setBoardSize(msg.boardSize); setShips(msg.ships);
            wireConn(conn, msg.hostName || "Host", false);
            setView("lobby");
          } else if (msg.type === "full") {
            setStatusMsg("That room is already full.");
          }
        },
        onClose: () => { setStatusMsg("Disconnected."); teardownNetwork(); setRole(null); setView("menu"); },
      });
      peerRef.current = peer;
      connRef.current = conn;
    } catch (e) {
      setStatusMsg("Error: " + e.message);
    }
  };

  const leaveGame = () => {
    teardownNetwork();
    setRole(null); setRoomId(""); setStatusMsg(""); setOpponentName(""); setDisconnected(false);
    resetForNewMatch(boardSize, ships);
    setView("menu");
  };

  // Host can keep tuning the config while guests are still in the lobby —
  // pushed live so a connected guest always sees what they're about to play.
  useEffect(() => {
    if (role === "host" && view === "lobby" && connRef.current?.open) {
      connRef.current.send({ type: "config", boardSize, ships });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize, ships]);

  const startMatch = () => {
    const hostGoesFirst = hostGoesFirstToggleRef.current;
    connRef.current?.send({ type: "start", boardSize, ships, hostGoesFirst });
    setMyGoesFirst(hostGoesFirst);
    resetForNewMatch(boardSize, ships);
    setView("placement");
  };

  // ─── Placement ──────────────────────────────────────────────────────────
  const allPlaced = placedShips.every(s => s != null);

  const previewCells = (activeShipIndex != null && hoverCell)
    ? engine.cellsFor(hoverCell.x, hoverCell.y, ships[activeShipIndex], orientation === "h")
    : [];
  const previewValid = (activeShipIndex != null && hoverCell)
    ? engine.canPlaceShip(hoverCell.x, hoverCell.y, ships[activeShipIndex], orientation === "h",
        placedShips.filter((s, i) => s && i !== activeShipIndex), boardSize)
    : false;

  const selectPendingShip = (i) => {
    if (placedShips[i]) setPlacedShips(prev => prev.map((s, idx) => idx === i ? null : s));
    setActiveShipIndex(i);
  };

  const placeAt = (x, y) => {
    if (activeShipIndex == null) return;
    const others = placedShips.filter((s, i) => s && i !== activeShipIndex);
    const ship = engine.placeShip(x, y, ships[activeShipIndex], orientation === "h", others, boardSize);
    if (!ship) return;
    const next = [...placedShips];
    next[activeShipIndex] = ship;
    setPlacedShips(next);
    const nextIdx = next.findIndex(s => s == null);
    setActiveShipIndex(nextIdx === -1 ? null : nextIdx);
  };

  const randomize = () => {
    const result = engine.randomizeFleet(ships, boardSize);
    if (!result) { setStatusMsg("Couldn't fit that fleet — try again or shrink it."); return; }
    setPlacedShips(result);
    setActiveShipIndex(null);
    setStatusMsg("");
  };

  const resetPlacement = () => {
    setPlacedShips(Array(ships.length).fill(null));
    setActiveShipIndex(0);
  };

  const confirmReady = () => {
    if (!allPlaced) return;
    connRef.current?.send({ type: "ready" });
    setPlacementReady(true);
  };

  useEffect(() => {
    if (placementReady && opponentReady) {
      setMyTurn(myGoesFirst);
      setView("battle");
    }
  }, [placementReady, opponentReady, myGoesFirst]);

  const myShipCellClass = (x, y) => {
    const isPreview = previewCells.some(c => c.x === x && c.y === y);
    if (isPreview) return previewValid ? "bg-emerald-600/80" : "bg-red-600/70";
    const onShip = placedShips.some(s => s && s.cells.some(c => c.x === x && c.y === y));
    return onShip ? "bg-slate-400" : "bg-blue-900/40 hover:bg-blue-800/60";
  };

  // ─── Battle ─────────────────────────────────────────────────────────────
  const fireAtOpponent = (x, y) => {
    if (!myTurn || gameOverState) return;
    if (shotsFired.some(s => s.x === x && s.y === y)) return;
    connRef.current?.send({ type: "fire", x, y });
    // The whole grid disables the instant myTurn flips false — the actual
    // marker is added once the "result" message comes back with hit/miss.
    setMyTurn(false);
  };

  const resign = () => {
    connRef.current?.send({ type: "resign" });
    setGameOverState(prev => prev ?? { won: false, reason: "resign" });
  };

  const triggerRematch = () => {
    hostGoesFirstToggleRef.current = !hostGoesFirstToggleRef.current;
    const hostGoesFirst = hostGoesFirstToggleRef.current;
    connRef.current?.send({ type: "rematch", boardSize, ships, hostGoesFirst });
    setMyGoesFirst(hostGoesFirst);
    resetForNewMatch(boardSize, ships);
    setView("placement");
  };

  const myBoardBattleCellClass = (x, y) => {
    const shot = myBoardShots.find(s => s.x === x && s.y === y);
    if (shot) return shot.hit ? "bg-red-600" : "bg-slate-600";
    const onShip = placedShips.some(s => s.cells.some(c => c.x === x && c.y === y));
    return onShip ? "bg-slate-400" : "bg-blue-900/40";
  };
  const enemyCellClass = (x, y) => {
    const shot = shotsFired.find(s => s.x === x && s.y === y);
    if (shot?.hit) return "bg-red-600";
    if (shot) return "bg-slate-600";
    return myTurn && !gameOverState ? "bg-blue-900/40 hover:bg-emerald-700/60 cursor-pointer" : "bg-blue-900/40 opacity-70";
  };
  const cellMark = (shot) => shot ? (shot.hit ? "💥" : "•") : "";

  // Auto-fill (not auto-join) from a shared link.
  useEffect(() => {
    if (autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) setJoinInput(room.toUpperCase());
  }, []);

  // ─── Views ──────────────────────────────────────────────────────────────

  if (view === "menu") return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 to-slate-900 px-4 pt-16 pb-8 text-white">
      <h1 className="text-3xl font-bold text-center mb-1 tracking-tight">🚢 Battleship</h1>
      <p className="text-center text-slate-400 text-sm mb-6">Online PvP only — sink the enemy fleet.</p>

      <div className="max-w-md mx-auto bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl">
        <input placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)}
          className="w-full px-3 py-2 mb-4 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white outline-none focus:border-indigo-500" />

        <div className="mb-1">
          <p className="text-xs text-slate-400 mb-2">Match setup (used when you host — you can keep tuning it in the lobby too)</p>
          <FleetConfigEditor
            boardSize={boardSize} ships={ships}
            onBoardSizeChange={size => { setBoardSize(size); setShips(engine.defaultFleetFor(size)); }}
            onShipsChange={setShips}
          />
        </div>

        <button onClick={hostGame} className="w-full px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold mb-5 transition-colors">
          🌐 Host a Room
        </button>

        <div className="flex items-center gap-3 text-slate-500 text-xs mb-4">
          <div className="flex-1 h-px bg-slate-700" /> or join a friend <div className="flex-1 h-px bg-slate-700" />
        </div>
        <div className="flex gap-2 mb-3">
          <input placeholder="Room code (e.g. AB12CD)" value={joinInput}
            onChange={e => setJoinInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && joinGame()}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white outline-none focus:border-indigo-500" />
          <button onClick={() => joinGame()} className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-600 font-semibold text-sm transition-colors">Join</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <input type="checkbox" checked={discoverable} onChange={e => setDiscoverable(e.target.checked)} />
          List my room publicly so others can find it below
        </label>

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
                <button key={r.roomId} onClick={() => joinGame(r.roomId)}
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
    </div>
  );

  if (view === "lobby") return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-4 pt-16 text-white">
      <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl max-w-md w-full text-center">
        {role === "host" ? (
          <>
            <h2 className="text-xl font-bold mb-1">Room ready</h2>
            <p className="text-slate-400 text-sm mb-4">Share the code, link, or QR — you can still tweak the board/fleet above until you start.</p>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-3">
              <code className="flex-1 text-xl tracking-widest text-indigo-300 font-mono">{roomId}</code>
              <CopyButton text={roomId} label="Copy Code" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 text-[11px] text-slate-500 truncate text-left">{buildShareLink(roomId)}</code>
              <CopyButton text={buildShareLink(roomId)} label="Copy Link" />
            </div>
            <img src={buildQrUrl(buildShareLink(roomId), 180)} alt="Scan to join" width={160} height={160} className="mx-auto rounded-lg mb-4 bg-white p-2" />
            <FleetConfigEditor
              boardSize={boardSize} ships={ships}
              onBoardSizeChange={size => { setBoardSize(size); setShips(engine.defaultFleetFor(size)); }}
              onShipsChange={setShips}
            />
            <p className={`text-sm mb-4 ${opponentName ? "text-emerald-400" : "text-slate-500"}`}>
              {opponentName ? `✅ ${opponentName} connected` : "Waiting for an opponent…"}
            </p>
            <div className="flex gap-2">
              <button onClick={leaveGame} className="px-4 py-2 rounded-full bg-red-700 hover:bg-red-600 text-sm transition-colors">Cancel</button>
              <button onClick={startMatch} disabled={!opponentName} className="flex-1 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed font-semibold transition-colors">
                Start Game
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-2">Connected!</h2>
            <p className="text-slate-400 text-sm mb-2">vs {opponentName || "host"}</p>
            <p className="text-sm text-slate-300 mb-6">Board {boardSize}×{boardSize} · {ships.length} ships ({ships.join(", ")})</p>
            <p className="text-slate-500 text-sm mb-6">Waiting for the host to start…</p>
            <button onClick={leaveGame} className="px-6 py-2 rounded-full bg-red-700 hover:bg-red-600 font-semibold transition-colors">Leave</button>
          </>
        )}
      </div>
    </div>
  );

  if (view === "placement") return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center p-4 pt-16 text-white">
      <h2 className="text-xl font-bold mb-1">Place your fleet</h2>
      <p className="text-slate-400 text-sm mb-4 text-center">Pick a ship below, choose an orientation, then click the grid.</p>

      <div className="flex flex-wrap gap-1.5 justify-center mb-3 max-w-md">
        {ships.map((len, i) => (
          <button key={i} onClick={() => selectPendingShip(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              activeShipIndex === i ? "bg-indigo-600 border-indigo-400" :
              placedShips[i] ? "bg-emerald-800/60 border-emerald-600 text-emerald-200" :
              "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400"
            }`}>
            {placedShips[i] ? "✓ " : ""}Len {len}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setOrientation(o => o === "h" ? "v" : "h")} className="px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors">
          ⟳ Orientation: {orientation === "h" ? "Horizontal" : "Vertical"}
        </button>
        <button onClick={randomize} className="px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors">🎲 Random</button>
        <button onClick={resetPlacement} className="px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors">↺ Reset</button>
      </div>

      <BoardGrid
        size={boardSize}
        onCellClick={placeAt}
        onCellHover={(x, y) => setHoverCell({ x, y })}
        onCellLeave={() => setHoverCell(null)}
        cellClass={myShipCellClass}
      />

      {statusMsg && <p className="text-amber-300 text-sm text-center mt-4">{statusMsg}</p>}

      <div className="mt-5 flex flex-col items-center gap-2">
        {placementReady ? (
          <p className="text-emerald-400 text-sm">
            Ready! {opponentReady ? "Starting…" : `Waiting for ${opponentName || "opponent"}…`}
          </p>
        ) : (
          <button onClick={confirmReady} disabled={!allPlaced}
            className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed font-semibold shadow-lg transition-colors">
            Ready!
          </button>
        )}
        {disconnected && <p className="text-red-400 text-sm">Opponent disconnected.</p>}
        <button onClick={leaveGame} className="px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-xs transition-colors mt-2">Leave</button>
      </div>
    </div>
  );

  // view === "battle"
  const turnText = gameOverState
    ? (gameOverState.won
        ? (gameOverState.reason === "resign" ? "Opponent resigned — you win! 🏆"
          : gameOverState.reason === "disconnect" ? "Opponent disconnected — you win! 🏆"
          : "You sank the enemy fleet! 🏆")
        : (gameOverState.reason === "resign" ? "You resigned."
          : "Your fleet was destroyed. 💥"))
    : myTurn ? "Your turn — fire at the enemy waters!" : `${opponentName || "Opponent"}'s turn…`;

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center p-4 pt-16 text-white">
      <h2 className="text-xl font-bold mb-1">🚢 Battleship</h2>
      <div className={`px-4 py-2 rounded-lg font-bold text-sm mb-4 text-center ${gameOverState ? "bg-indigo-600" : myTurn ? "bg-emerald-700" : "bg-slate-700"}`}>
        {turnText}
      </div>

      <div className="flex flex-wrap gap-6 justify-center items-start">
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-slate-400 mb-1">Your Fleet</p>
          <BoardGrid size={boardSize} cellClass={myBoardBattleCellClass} cellContent={(x, y) => cellMark(myBoardShots.find(s => s.x === x && s.y === y))} disabled />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-slate-400 mb-1">Enemy Waters</p>
          <BoardGrid size={boardSize} onCellClick={fireAtOpponent} cellClass={enemyCellClass}
            cellContent={(x, y) => cellMark(shotsFired.find(s => s.x === x && s.y === y))}
            disabled={!myTurn || !!gameOverState} />
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center gap-2">
        {!gameOverState && <button onClick={resign} className="px-5 py-2 rounded-full bg-red-700 hover:bg-red-600 font-semibold text-sm transition-colors">Resign</button>}
        {gameOverState && (
          role === "host" ? (
            <button onClick={triggerRematch} className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-lg transition-colors">Rematch</button>
          ) : (
            <p className="text-slate-400 text-sm">Waiting for the host to start a rematch…</p>
          )
        )}
        <button onClick={leaveGame} className="px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-xs transition-colors mt-1">Leave Table</button>
      </div>
    </div>
  );
}
