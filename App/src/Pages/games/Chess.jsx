import { useState, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import {
  FaChessPawn, FaChessKnight, FaChessBishop,
  FaChessRook, FaChessQueen, FaChessKing,
} from "react-icons/fa";

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
    </div>
  </div>
);

// ─── Main game ───────────────────────────────────────────────────────────────
const ChessBoard = ({ mode, onBack }) => {
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

  const getStatus = useCallback((c) => {
    if (c.isCheckmate()) return `Checkmate! ${c.turn() === "b" ? "White" : "Black"} wins! 🏆`;
    if (c.isStalemate()) return "Stalemate! Draw 🤝";
    if (c.isDraw()) return "Draw! 🤝";
    const turnName = c.turn() === "w" ? "White" : "Black";
    const inCk = c.inCheck();
    if (is1P) {
      if (c.turn() === "w") return inCk ? "⚠️ You are in check!" : "Your turn (White)";
      return inCk ? "AI is in check" : "AI thinking...";
    }
    return inCk ? `⚠️ ${turnName} is in check!` : `${turnName}'s turn`;
  }, [is1P]);

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
    return true;
  };

  const handleSquareClick = (row, col) => {
    if (gameOver || thinking) return;
    // In 1P mode, only allow white to click
    if (is1P && chess.turn() !== "w") return;

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 pt-16">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6 items-start justify-center">

        {/* Board area */}
        <div className="flex flex-col items-center gap-2">

          {/* Status bar */}
          <div className={`w-full text-center px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            gameOver ? "bg-indigo-600 text-white" :
            thinking ? "bg-slate-700 text-yellow-300 animate-pulse" :
            inCheck ? "bg-red-600/80 text-white" :
            "bg-slate-800 text-gray-300"
          }`}>
            {thinking ? "🤖 AI is thinking..." : status}
          </div>

          {/* 2P turn indicator */}
          {!is1P && !gameOver && (
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
              {[8,7,6,5,4,3,2,1].map(r => (
                <div key={r} className="flex-1 flex items-center text-xs text-gray-400 font-mono">{r}</div>
              ))}
            </div>
            <div className="absolute -bottom-5 left-0 w-full flex">
              {["a","b","c","d","e","f","g","h"].map(f => (
                <div key={f} className="flex-1 text-center text-xs text-gray-400 font-mono">{f}</div>
              ))}
            </div>

            <div
              className="grid grid-cols-8"
              style={{ width: "min(480px, 90vw)", height: "min(480px, 90vw)", gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)", containerType: "inline-size" }}
            >
              {board.map((rowArr, row) =>
                rowArr.map((piece, col) => {
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
            <p className="text-gray-400 text-xs mb-4">{is1P ? "You play as White. AI plays Black." : "Two players, same screen."}</p>

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

            <button onClick={resetGame} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all text-sm mb-2">
              New Game
            </button>
            <button onClick={onBack} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 font-semibold rounded-lg transition-all text-sm">
              ← Change Mode
            </button>
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

// ─── Root component ──────────────────────────────────────────────────────────
export default function ChessGame() {
  const [mode, setMode] = useState(null);       // null | "1p" | "2p"
  const [difficulty, setDifficulty] = useState(2);

  if (!mode) return <ModeSelect onSelect={setMode} />;
  return <ChessBoard key={mode} mode={mode} difficulty={difficulty} onBack={() => setMode(null)} />;
}