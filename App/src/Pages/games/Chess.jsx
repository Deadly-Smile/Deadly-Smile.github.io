import { useState, useCallback, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import {
  FaChessPawn, FaChessKnight, FaChessBishop,
  FaChessRook, FaChessQueen, FaChessKing,
} from "react-icons/fa";
import {
  hostSimpleRoom, joinSimpleRoom, buildQrUrl,
  registerOpenRoom, unregisterOpenRoom, fetchOpenRooms,
} from "../tools/tk-shared.jsx";

const ROOM_HEARTBEAT_MS = 20000;
function buildChessShareLink(roomId) {
  return `${window.location.origin}/games?game=chess&room=${roomId}`;
}

// ─── Piece rendering ────────────────────────────────────────────────────────
const PIECE_COLORS = {
  w: { color: "#f0d9b5", filter: "drop-shadow(0 0 2px #7a5c00) drop-shadow(0 2px 4px rgba(0,0,0,0.7))" },
  b: { color: "#1a0f00", filter: "drop-shadow(0 0 2px #c8a876) drop-shadow(0 2px 4px rgba(0,0,0,0.8))" },
};
const ICON_MAP = { p: FaChessPawn, n: FaChessKnight, b: FaChessBishop, r: FaChessRook, q: FaChessQueen, k: FaChessKing };

const PieceSVG = ({ type, color, size = "72%" }) => {
  const Icon = ICON_MAP[type];
  if (!Icon) return null;
  const { color: iconColor, filter } = PIECE_COLORS[color];
  return (
    <Icon style={{ width: size, height: size, color: iconColor, filter, display: "block", pointerEvents: "none", position: "relative", zIndex: 20, flexShrink: 0 }} />
  );
};

// ─── AI logic ───────────────────────────────────────────────────────────────
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const PAWN_TABLE   = [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0];
const KNIGHT_TABLE = [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50];
const BISHOP_TABLE = [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20];
const ROOK_TABLE   = [0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0];
const QUEEN_TABLE  = [-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20];
const KING_TABLE   = [-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20];

function getPieceTable(t) { return { p: PAWN_TABLE, n: KNIGHT_TABLE, b: BISHOP_TABLE, r: ROOK_TABLE, q: QUEEN_TABLE, k: KING_TABLE }[t] || null; }

function evaluateBoard(chess) {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -99999 : 99999;
  if (chess.isDraw()) return 0;
  let score = 0;
  chess.board().forEach((row, r) => row.forEach((piece, c) => {
    if (!piece) return;
    const val = PIECE_VALUES[piece.type] || 0;
    const tbl = getPieceTable(piece.type);
    const idx = piece.color === "w" ? r * 8 + c : (7 - r) * 8 + c;
    score += piece.color === "w" ? val + (tbl ? tbl[idx] : 0) : -(val + (tbl ? tbl[idx] : 0));
  }));
  return score;
}

function minimax(chess, depth, alpha, beta, isMax) {
  if (depth === 0 || chess.isGameOver()) return evaluateBoard(chess);
  const moves = chess.moves();
  if (isMax) {
    let best = -Infinity;
    for (const m of moves) { chess.move(m); best = Math.max(best, minimax(chess, depth-1, alpha, beta, false)); chess.undo(); alpha = Math.max(alpha, best); if (beta <= alpha) break; }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) { chess.move(m); best = Math.min(best, minimax(chess, depth-1, alpha, beta, true)); chess.undo(); beta = Math.min(beta, best); if (beta <= alpha) break; }
    return best;
  }
}

function getBestMove(chess, depth) {
  const moves = chess.moves({ verbose: true });
  let bestMove = null, bestVal = Infinity;
  for (const move of moves) {
    chess.move(move);
    const val = minimax(chess, depth - 1, -Infinity, Infinity, true);
    chess.undo();
    if (val < bestVal) { bestVal = val; bestMove = move; }
  }
  return bestMove;
}

// ─── Mode selector screen ───────────────────────────────────────────────────
const ModeSelect = ({ onSelect }) => (
  <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center gap-8 p-8">
    <div className="text-center">
      <div className="text-6xl mb-4">♟</div>
      <h1 className="text-4xl font-bold text-white mb-2">Chess</h1>
      <p className="text-gray-400">Choose your game mode</p>
    </div>
    <div className="flex flex-col sm:flex-row gap-5">
      <button
        onClick={() => onSelect("1p")}
        className="group flex flex-col items-center gap-3 px-10 py-8 rounded-2xl bg-slate-800 border-2 border-indigo-500/40 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/20 transition-all"
      >
        <div className="flex gap-2 items-end">
          <PieceSVG type="k" color="w" size="52px" />
          <div className="text-3xl text-slate-500 mb-1">vs</div>
          <PieceSVG type="k" color="b" size="52px" />
        </div>
        <div>
          <div className="text-white font-bold text-lg">vs Computer</div>
          <div className="text-gray-400 text-sm">Play against AI</div>
        </div>
      </button>

      <button
        onClick={() => onSelect("2p")}
        className="group flex flex-col items-center gap-3 px-10 py-8 rounded-2xl bg-slate-800 border-2 border-amber-500/40 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/20 transition-all"
      >
        <div className="flex gap-2 items-end">
          <PieceSVG type="k" color="w" size="52px" />
          <div className="text-3xl text-slate-500 mb-1">vs</div>
          <PieceSVG type="k" color="b" size="52px" />
        </div>
        <div>
          <div className="text-white font-bold text-lg">2 Players</div>
          <div className="text-gray-400 text-sm">Pass & play locally</div>
        </div>
      </button>

      <button
        onClick={() => onSelect("online")}
        className="group flex flex-col items-center gap-3 px-10 py-8 rounded-2xl bg-slate-800 border-2 border-emerald-500/40 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 transition-all"
      >
        <div className="flex gap-2 items-end">
          <PieceSVG type="k" color="w" size="52px" />
          <div className="text-3xl text-slate-500 mb-1">vs</div>
          <PieceSVG type="k" color="b" size="52px" />
        </div>
        <div>
          <div className="text-white font-bold text-lg">🌐 Online PvP</div>
          <div className="text-gray-400 text-sm">Room code, link, or QR</div>
        </div>
      </button>
    </div>
  </div>
);

// ─── Main game ───────────────────────────────────────────────────────────────
const ChessBoard = ({ mode, online, onBack }) => {
  const [chess] = useState(() => new Chess());
  const [board, setBoard] = useState(() => chess.board());
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [status, setStatus] = useState(mode === "1p" ? "Your turn (White)" : "White's turn");
  const [gameOver, setGameOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [difficulty, setDifficulty] = useState(2);  // 1 = easy, 2 = medium, 3 = hard, by default medium
  const [capturedW, setCapturedW] = useState([]);   // captured by white player
  const [capturedB, setCapturedB] = useState([]);   // captured by black player
  const [promotionPending, setPromotionPending] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [inCheck, setInCheck] = useState(false);
  const aiTimeoutRef = useRef(null);

  const is1P = mode === "1p";
  const isOnline = mode === "online";
  const mySide = is1P ? "w" : isOnline ? online.myColor : null;

  const getStatus = useCallback((c) => {
    if (c.isCheckmate()) return `Checkmate! ${c.turn() === "b" ? "White" : "Black"} wins! 🏆`;
    if (c.isStalemate()) return "Stalemate! Draw 🤝";
    if (c.isDraw()) return "Draw! 🤝";
    const turnName = c.turn() === "w" ? "White" : "Black";
    const inCk = c.inCheck();
    if (mySide) {
      if (c.turn() === mySide) return inCk ? "⚠️ You are in check!" : `Your turn${is1P ? " (White)" : ""}`;
      return inCk ? `${isOnline ? "Opponent" : "AI"} is in check` : (isOnline ? "Opponent's turn…" : "AI thinking...");
    }
    return inCk ? `⚠️ ${turnName} is in check!` : `${turnName}'s turn`;
  }, [mySide, is1P, isOnline]);

  const syncState = useCallback(() => {
    setBoard([...chess.board()]);
    setInCheck(chess.inCheck());
    setStatus(getStatus(chess));
    if (chess.isGameOver()) setGameOver(true);
  }, [chess, getStatus]);

  const resetGame = () => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    chess.reset();
    setSelected(null); setLegalMoves([]); setLastMove(null);
    setCapturedW([]); setCapturedB([]);
    setGameOver(false); setThinking(false); setPromotionPending(null);
    setMoveHistory([]);
    setBoard([...chess.board()]); setInCheck(false);
    setStatus(is1P ? "Your turn (White)" : "White's turn");
  };

  const doAiMove = useCallback(() => {
    if (!is1P || chess.turn() !== "b" || chess.isGameOver()) return;
    setThinking(true);
    aiTimeoutRef.current = setTimeout(() => {
      const best = getBestMove(chess, difficulty);
      if (best) {
        const result = chess.move(best);
        setLastMove({ from: best.from, to: best.to });
        setMoveHistory(h => [...h, result.san]);
        if (result.captured) setCapturedB(c => [...c, result.captured]);
      }
      setThinking(false);
      syncState();
    }, 100);
  }, [chess, difficulty, is1P, syncState]);

  const applyMove = (from, to, pieceType) => {
    const moveObj = pieceType
      ? { from, to, promotion: pieceType }
      : { from, to };
    const result = chess.move(moveObj);
    if (!result) return false;

    setLastMove({ from, to });
    setMoveHistory(h => [...h, result.san]);
    if (result.captured) {
      // The side that just moved captured an enemy piece
      if (result.color === "w") setCapturedW(c => [...c, result.captured]);
      else setCapturedB(c => [...c, result.captured]);
    }
    setSelected(null); setLegalMoves([]);
    syncState();
    if (is1P) setTimeout(doAiMove, 300);
    // `promotion` is only ever included when it's actually a promotion — an
    // explicit `undefined` field can trip up PeerJS's MessagePack encoding.
    if (isOnline) online.sendMove(pieceType ? { from, to, promotion: pieceType } : { from, to });
    return true;
  };

  // Mirrors applyMove but for a move that already happened on the opponent's
  // board — never re-sent, never triggers the AI. chess.move() returning null
  // on anything illegal doubles as a desync guard against a stale/bad peer.
  const applyRemoteMove = useCallback(({ from, to, promotion }) => {
    const result = chess.move(promotion ? { from, to, promotion } : { from, to });
    if (!result) return;
    setLastMove({ from, to });
    setMoveHistory(h => [...h, result.san]);
    if (result.captured) {
      if (result.color === "w") setCapturedW(c => [...c, result.captured]);
      else setCapturedB(c => [...c, result.captured]);
    }
    setSelected(null); setLegalMoves([]);
    syncState();
  }, [chess, syncState]);

  useEffect(() => {
    if (isOnline && online.incomingMove) applyRemoteMove(online.incomingMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online?.incomingMove]);

  const handleSquareClick = (row, col) => {
    if (gameOver || thinking) return;
    // In 1P mode, only allow white to click
    if (is1P && chess.turn() !== "w") return;
    // Online: only allow moves on your own turn, and never after the game's
    // effectively over from your side's perspective.
    if (isOnline && (chess.turn() !== mySide || online.disconnected || online.opponentResigned || online.iResigned)) return;

    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    const sq = `${file}${rank}`;
    const piece = chess.get(sq);
    const currentTurn = chess.turn();

    if (selected) {
      const move = legalMoves.find(m => m.to === sq);
      if (move) {
        if (move.piece === "p" && (rank === 8 || rank === 1)) {
          setPromotionPending({ from: selected, to: sq });
          return;
        }
        applyMove(selected, sq);
        return;
      }
      // Clicked same color piece — reselect
      if (piece && piece.color === currentTurn) {
        setSelected(sq);
        setLegalMoves(chess.moves({ square: sq, verbose: true }));
        return;
      }
      setSelected(null); setLegalMoves([]);
      return;
    }

    if (piece && piece.color === currentTurn) {
      setSelected(sq);
      setLegalMoves(chess.moves({ square: sq, verbose: true }));
    }
  };

  const handlePromotion = (pieceType) => {
    if (!promotionPending) return;
    const { from, to } = promotionPending;
    setPromotionPending(null);
    applyMove(from, to, pieceType);
  };

  const getCellStyle = (row, col) => {
    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    const sq = `${file}${rank}`;
    const isLight = (row + col) % 2 === 0;
    const isSelected = selected === sq;
    const isLegal = legalMoves.some(m => m.to === sq);
    const isLastFrom = lastMove?.from === sq;
    const isLastTo = lastMove?.to === sq;
    const piece = chess.get(sq);
    const isKingInCheck = inCheck && piece?.type === "k" && piece?.color === chess.turn();

    let bg = isLight ? "#f0d9b5" : "#b58863";
    if (isSelected) bg = "#f6f669";
    else if (isLastFrom || isLastTo) bg = isLight ? "#cdd16c" : "#aaa23a";
    if (isKingInCheck) bg = "#e84040";

    return { background: bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", userSelect: "none" };
  };

  // Turn indicator for 2P — show a colored bar
  const turnColor = chess.turn();
  const onlineOver = isOnline && (online.opponentResigned || online.disconnected || online.iResigned);
  // Online is the only mode with one fixed "the player" per client — 1P is
  // always White, and local 2P pass-and-play has no single perspective to
  // flip to since both sides share the screen.
  const flipped = isOnline && mySide === "b";
  const displayStatus = online?.opponentResigned ? "Opponent resigned — you win! 🏆"
    : online?.iResigned ? "You resigned."
    : online?.disconnected ? "Opponent disconnected."
    : status;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 pt-16">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6 items-start justify-center">

        {/* Board area */}
        <div className="flex flex-col items-center gap-2">

          {/* Status bar */}
          <div className={`w-full text-center px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            gameOver || onlineOver ? "bg-indigo-600 text-white" :
            thinking ? "bg-slate-700 text-yellow-300 animate-pulse" :
            inCheck ? "bg-red-600/80 text-white" :
            "bg-slate-800 text-gray-300"
          }`}>
            {thinking ? "🤖 AI is thinking..." : displayStatus}
          </div>

          {/* 2P/online turn indicator */}
          {!is1P && !gameOver && !onlineOver && (
            <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: turnColor === "w" ? "#f0d9b5" : "#1a0f00", border: "2px solid #8b6914", flexShrink: 0 }} />
              <span className="text-gray-300 text-xs font-semibold">{turnColor === "w" ? "White" : "Black"} to move</span>
            </div>
          )}

          {/* Captured by White */}
          <div className="w-full min-h-7 flex flex-wrap items-center gap-0.5 bg-slate-800/50 rounded px-2 py-1">
            {capturedW.map((t, i) => (
              <div key={i} style={{ width: 20, height: 20, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <PieceSVG type={t} color="b" size="100%" />
              </div>
            ))}
            {capturedW.length === 0 && <span className="text-slate-600 text-xs">No captures yet</span>}
          </div>

          {/* Board */}
          <div className="relative border-2 border-amber-900 rounded shadow-2xl shadow-black/60">
            <div className="absolute -left-5 top-0 h-full flex flex-col">
              {(flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1]).map(r => (
                <div key={r} className="flex-1 flex items-center text-xs text-gray-400 font-mono">{r}</div>
              ))}
            </div>
            <div className="absolute -bottom-5 left-0 w-full flex">
              {(flipped ? ["h","g","f","e","d","c","b","a"] : ["a","b","c","d","e","f","g","h"]).map(f => (
                <div key={f} className="flex-1 text-center text-xs text-gray-400 font-mono">{f}</div>
              ))}
            </div>

            <div
              className="grid grid-cols-8"
              style={{ width: "min(480px, 90vw)", height: "min(480px, 90vw)", gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)", containerType: "inline-size" }}
            >
              {/* Iterates fixed visual grid positions and translates to model
                  (row,col) coordinates — flips the perspective for a Black
                  player online without touching getCellStyle/handleSquareClick,
                  which only ever care that row/col name a consistent square. */}
              {Array.from({ length: 8 }, (_, visRow) =>
                Array.from({ length: 8 }, (_, visCol) => {
                  const row = flipped ? 7 - visRow : visRow;
                  const col = flipped ? 7 - visCol : visCol;
                  const piece = board[row][col];
                  const file = String.fromCharCode(97 + col);
                  const rank = 8 - row;
                  const sq = `${file}${rank}`;
                  const isLegal = legalMoves.some(m => m.to === sq);
                  const hasEnemyPiece = isLegal && piece && piece.color !== chess.turn();

                  return (
                    <div key={sq} style={getCellStyle(row, col)} onClick={() => handleSquareClick(row, col)}>
                      {isLegal && !hasEnemyPiece && (
                        <div style={{ position: "absolute", width: "33%", height: "33%", borderRadius: "50%", background: "rgba(0,0,0,0.22)", zIndex: 10, pointerEvents: "none" }} />
                      )}
                      {isLegal && hasEnemyPiece && (
                        <div style={{ position: "absolute", inset: 0, border: "4px solid rgba(0,0,0,0.28)", zIndex: 10, pointerEvents: "none" }} />
                      )}
                      {piece && <PieceSVG type={piece.type} color={piece.color} />}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Captured by Black */}
          <div className="w-full min-h-7 flex flex-wrap items-center gap-0.5 bg-slate-800/50 rounded px-2 py-1">
            {capturedB.map((t, i) => (
              <div key={i} style={{ width: 20, height: 20, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <PieceSVG type={t} color="w" size="100%" />
              </div>
            ))}
            {capturedB.length === 0 && <span className="text-slate-600 text-xs">No captures yet</span>}
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4 w-full lg:w-64">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-bold text-lg mb-1">♟ Chess</h3>
            <p className="text-gray-400 text-xs mb-4">
              {is1P ? "You play as White. AI plays Black."
                : isOnline ? `You play as ${mySide === "w" ? "White" : "Black"}, vs ${online.opponentName || "opponent"}.`
                : "Two players, same screen."}
            </p>

            {is1P && (
              <>
                <label className="text-gray-300 text-sm font-semibold block mb-1">Difficulty</label>
                <div className="flex gap-2 mb-4">
                  {[["Easy", 1], ["Med", 2], ["Hard", 3]].map(([label, val]) => (
                    <button key={val} onClick={() => { setDifficulty(val); }} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${difficulty === val ? "bg-indigo-600 text-white" : "bg-slate-700 text-gray-400 hover:bg-slate-600"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {isOnline ? (
              <>
                {!gameOver && !onlineOver && (
                  <button onClick={online.onResign} className="w-full py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg transition-all text-sm mb-2">
                    Resign
                  </button>
                )}
                {(gameOver || onlineOver) && !online.disconnected && (
                  online.isHost ? (
                    <button onClick={online.onRematch} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all text-sm mb-2">
                      Rematch
                    </button>
                  ) : (
                    <p className="text-gray-400 text-xs mb-2">Waiting for the host to start a rematch…</p>
                  )
                )}
                <button onClick={onBack} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 font-semibold rounded-lg transition-all text-sm">
                  ← Leave Game
                </button>
              </>
            ) : (
              <>
                <button onClick={resetGame} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all text-sm mb-2">
                  New Game
                </button>
                <button onClick={onBack} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 font-semibold rounded-lg transition-all text-sm">
                  ← Change Mode
                </button>
              </>
            )}
          </div>

          {/* Move history */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex-1">
            <h4 className="text-gray-300 font-semibold text-sm mb-2">Move History</h4>
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {moveHistory.length === 0 && <p className="text-slate-600 text-xs">No moves yet</p>}
              {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono">
                  <span className="text-slate-500 w-5">{i + 1}.</span>
                  <span className="text-amber-300 w-12">{moveHistory[i * 2] || ""}</span>
                  <span className="text-slate-300 w-12">{moveHistory[i * 2 + 1] || ""}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-xs text-gray-500">
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-black/25" /><span>Legal move</span></div>
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-sm" style={{ background:"#f6f669" }} /><span>Selected / Last move</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-500" /><span>King in check</span></div>
          </div>
        </div>
      </div>

      {/* Promotion modal */}
      {promotionPending && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 border border-indigo-500 shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-4 text-center">Promote Pawn</h3>
            <div className="flex gap-4">
              {[["q","Queen"],["r","Rook"],["b","Bishop"],["n","Knight"]].map(([type, name]) => (
                <button key={type} onClick={() => handlePromotion(type)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-700 hover:bg-indigo-600 transition-all group">
                  <div style={{ width: 44, height: 44, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <PieceSVG type={type} color={chess.turn() === "w" ? "w" : "b"} size="100%" />
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-white">{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

// ─── Online PvP: room lobby + networking ────────────────────────────────────
// No shared/authoritative game state (unlike Poker) — each peer runs its own
// chess.js instance and stays in sync purely by exchanging moves, since chess
// has no hidden information to protect or redact. Only the host decides
// colors (fresh coin flip each game/rematch) and can trigger a rematch —
// mirrors Poker's "only the host/solo side advances the game, the guest
// waits" convention.
function OnlineChess({ onBack }) {
  const [view, setView] = useState("menu"); // menu | lobby | game
  const [role, setRole] = useState(null);   // host | guest
  const [nameInput, setNameInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [roomId, setRoomId] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [myColor, setMyColor] = useState(null);
  const [opponentName, setOpponentName] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [opponentResigned, setOpponentResigned] = useState(false);
  const [iResigned, setIResigned] = useState(false);
  const [incomingMove, setIncomingMove] = useState(null);
  const [gameEpoch, setGameEpoch] = useState(0);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const roomHeartbeatRef = useRef(null);
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
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

  // Attaches the in-game message handler for a now-open connection and moves
  // to the board. `isHostSide` is passed explicitly (not read from `role`
  // state) so the closure below can't go stale.
  const wireConn = useCallback((conn, assignedColor, oppName, isHostSide) => {
    connRef.current = conn;
    setMyColor(assignedColor);
    setOpponentName(oppName);
    setDisconnected(false);
    setOpponentResigned(false);
    setIResigned(false);
    setView("game");

    conn.on("data", (msg) => {
      if (msg.type === "move") setIncomingMove({ ...msg, seq: Math.random() });
      else if (msg.type === "resign") setOpponentResigned(true);
      else if (msg.type === "rematch") {
        // Only meaningful on the guest side — the host decides its own new
        // color locally the moment it triggers the rematch, not from an echo.
        if (!isHostSide) setMyColor(msg.guestColor);
        setOpponentResigned(false);
        setIResigned(false);
        setIncomingMove(null);
        setGameEpoch(e => e + 1);
      }
    });
    conn.on("close", () => setDisconnected(true));
  }, []);

  const refreshOpenRooms = useCallback(async () => {
    setRoomsLoading(true);
    setOpenRooms(await fetchOpenRooms("chess"));
    setRoomsLoading(false);
  }, []);
  useEffect(() => { if (view === "menu") refreshOpenRooms(); }, [view, refreshOpenRooms]);

  const hostGame = async () => {
    setStatusMsg("Starting room…");
    try {
      const { peer, roomId: newRoomId } = await hostSimpleRoom({
        onJoin: (conn, name) => {
          const hostColor = Math.random() < 0.5 ? "w" : "b";
          const guestColor = hostColor === "w" ? "b" : "w";
          conn.send({ type: "welcome", hostColor, guestColor, hostName: nameInput.trim() || "Host" });
          wireConn(conn, hostColor, name || "Guest", true);
        },
        onAction: () => {}, // no host-authoritative funnel needed — moves flow peer-to-peer
        onLeave: () => setDisconnected(true),
      });
      peerRef.current = peer;
      setRoomId(newRoomId);
      setRole("host");
      setView("lobby");
      setStatusMsg("");
      if (discoverable) {
        registerOpenRoom(newRoomId, "chess");
        roomHeartbeatRef.current = setInterval(() => registerOpenRoom(newRoomId, "chess"), ROOM_HEARTBEAT_MS);
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
            setRoomId(code);
            setRole("guest");
            wireConn(conn, msg.guestColor, msg.hostName || "Host", false);
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
    setRole(null); setRoomId(""); setStatusMsg("");
    setMyColor(null); setOpponentName(""); setDisconnected(false); setOpponentResigned(false); setIResigned(false);
    setIncomingMove(null); setGameEpoch(0);
    setView("menu");
  };

  const sendMove = useCallback((move) => connRef.current?.send({ type: "move", ...move }), []);
  const resign = useCallback(() => { connRef.current?.send({ type: "resign" }); setIResigned(true); }, []);
  const triggerRematch = useCallback(() => {
    const hostColor = Math.random() < 0.5 ? "w" : "b";
    const guestColor = hostColor === "w" ? "b" : "w";
    connRef.current?.send({ type: "rematch", hostColor, guestColor });
    setMyColor(hostColor);
    setOpponentResigned(false);
    setIResigned(false);
    setIncomingMove(null);
    setGameEpoch(e => e + 1);
  }, []);

  // Auto-fill (not auto-join) from a shared link — matches Poker's pattern.
  useEffect(() => {
    if (autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) setJoinInput(room.toUpperCase());
  }, []);

  if (view === "game") {
    return (
      <ChessBoard
        key={`online-${gameEpoch}`}
        mode="online"
        online={{
          myColor, opponentName, disconnected, opponentResigned, iResigned, incomingMove,
          isHost: role === "host", sendMove, onResign: resign, onRematch: triggerRematch,
        }}
        onBack={leaveGame}
      />
    );
  }

  if (view === "lobby") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 pt-16">
        <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-white mb-1">Room ready</h2>
          <p className="text-slate-400 text-sm mb-4">Share the code, link, or QR — the game starts as soon as someone joins.</p>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-3">
            <code className="flex-1 text-xl tracking-widest text-indigo-300 font-mono">{roomId}</code>
            <CopyButton text={roomId} label="Copy Code" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 text-[11px] text-slate-500 truncate text-left">{buildChessShareLink(roomId)}</code>
            <CopyButton text={buildChessShareLink(roomId)} label="Copy Link" />
          </div>
          <img src={buildQrUrl(buildChessShareLink(roomId), 180)} alt="Scan to join" width={160} height={160} className="mx-auto rounded-lg mb-4 bg-white p-2" />
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-4">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }} className="animate-pulse" />
            Waiting for an opponent…
          </div>
          <button onClick={leaveGame} className="px-4 py-2 rounded-full bg-red-700 hover:bg-red-600 text-sm transition-colors">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 pt-16">
      <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold text-white mb-1 text-center">🌐 Online PvP</h2>
        <p className="text-slate-400 text-sm mb-5 text-center">Host a room or join one — colors are assigned at random.</p>

        <input placeholder="Your name" value={nameInput} onChange={e => setNameInput(e.target.value)}
          className="w-full px-3 py-2 mb-3 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white outline-none focus:border-indigo-500" />

        <div className="flex gap-2 mb-3">
          <input placeholder="Room code (e.g. AB12CD)" value={joinInput}
            onChange={e => setJoinInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && joinGame()}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white outline-none focus:border-indigo-500" />
          <button onClick={() => joinGame()} className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors">Join</button>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <input type="checkbox" checked={discoverable} onChange={e => setDiscoverable(e.target.checked)} />
          List my room publicly so others can find it below
        </label>

        <button onClick={hostGame} className="w-full px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold mb-5 transition-colors">
          🌐 Host a Room
        </button>

        {statusMsg && <p className="text-amber-300 text-sm text-center mb-4">{statusMsg}</p>}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400">Open rooms — tap to join:</p>
            <button onClick={refreshOpenRooms} disabled={roomsLoading} className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 text-white text-xs transition-colors">
              {roomsLoading ? "…" : "⟳"}
            </button>
          </div>
          {openRooms.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {openRooms.map(r => (
                <button key={r.roomId} onClick={() => joinGame(r.roomId)}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-500 text-white text-sm text-left transition-colors">
                  {r.roomId} <span className="text-slate-500 text-xs">· waiting</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-xs">{roomsLoading ? "Checking…" : "None right now."}</p>
          )}
        </div>

        <button onClick={onBack} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 font-semibold rounded-lg transition-all text-sm">
          ← Change Mode
        </button>
      </div>
    </div>
  );
}

// ─── Root component ──────────────────────────────────────────────────────────
export default function ChessGame() {
  const [mode, setMode] = useState(() => {
    const room = new URLSearchParams(window.location.search).get("room");
    return room ? "online" : null; // shared link (?game=chess&room=XXXXXX) jumps straight to Online PvP
  });
  const [difficulty, setDifficulty] = useState(2);

  if (!mode) return <ModeSelect onSelect={setMode} />;
  if (mode === "online") return <OnlineChess onBack={() => setMode(null)} />;
  return <ChessBoard key={mode} mode={mode} difficulty={difficulty} onBack={() => setMode(null)} />;
}