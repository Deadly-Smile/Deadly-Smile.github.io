import { useState, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const SUITS    = ["♠", "♥", "♦", "♣"];
const RANKS    = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RED_SUITS = new Set(["♥","♦"]);
const isRed    = s => RED_SUITS.has(s);
const rankIdx  = r => RANKS.indexOf(r);

const FACE_OFFSET = 32;  // px between face-up cards
const BACK_OFFSET = 16;  // px between face-down cards
const CARD_W = 76;
const CARD_H = 104;

// ─── Deck helpers ─────────────────────────────────────────────────────────────
function makeDeck() {
  const d = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ suit, rank, id: `${rank}${suit}` });
  return d;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initGame() {
  const deck = shuffle(makeDeck());
  const tableau = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let col = 0; col < 7; col++)
    for (let row = 0; row <= col; row++)
      tableau[col].push({ ...deck[idx++], faceUp: row === col });
  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }));
  return { tableau, stock, waste: [], foundations: [[],[],[],[]], selected: null, won: false, moves: 0 };
}

// ─── Rules ───────────────────────────────────────────────────────────────────
function canFoundation(card, pile) {
  if (!pile.length) return card.rank === "A";
  const top = pile[pile.length - 1];
  return top.suit === card.suit && rankIdx(card.rank) === rankIdx(top.rank) + 1;
}
function canTableau(card, col) {
  if (!col.length) return card.rank === "K";
  const top = col[col.length - 1];
  return top.faceUp && isRed(card.suit) !== isRed(top.suit) && rankIdx(card.rank) === rankIdx(top.rank) - 1;
}
const suitIdx = s => SUITS.indexOf(s);
const won = fs => fs.every(f => f.length === 13);

// Flip top card of a column if face-down
function flipTop(col) {
  if (!col.length) return col;
  const top = col[col.length - 1];
  if (top.faceUp) return col;
  return [...col.slice(0, -1), { ...top, faceUp: true }];
}

// ─── Column height calculation ────────────────────────────────────────────────
function colHeight(col) {
  if (!col.length) return CARD_H;
  let h = 0;
  for (let i = 0; i < col.length - 1; i++)
    h += col[i].faceUp ? FACE_OFFSET : BACK_OFFSET;
  return h + CARD_H;
}

// ─── Card offset for each position ───────────────────────────────────────────
function cardTop(col, idx) {
  let top = 0;
  for (let i = 0; i < idx; i++)
    top += col[i].faceUp ? FACE_OFFSET : BACK_OFFSET;
  return top;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const FELT      = "#1a5c2a";
const FELT_DARK = "#134a21";
const FELT_LT   = "#217a38";

const S = {
  root: {
    minHeight: "100vh",
    background: `radial-gradient(ellipse at 50% 30%, ${FELT_LT} 0%, ${FELT} 45%, ${FELT_DARK} 100%)`,
    fontFamily: "'Georgia', serif",
    padding: "16px 8px",
    paddingTop: "72px",
    overflowX: "auto",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    maxWidth: 640, margin: "0 auto 16px",
    flexWrap: "wrap", gap: 8,
  },
  pill: {
    background: "rgba(0,0,0,0.4)", borderRadius: 20,
    padding: "5px 16px", color: "#c8f0c8",
    fontSize: 13, fontWeight: "bold",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  newBtn: {
    background: "linear-gradient(135deg,#2d7a3a,#1a5c2a)",
    border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20,
    padding: "6px 20px", color: "#d4f5d4", fontWeight: "bold",
    fontSize: 13, cursor: "pointer",
  },
  area: { maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 },
  topRow: { display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "center" },
  tableauRow: { display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "center" },
  emptySlot: {
    width: CARD_W, height: CARD_H, borderRadius: 8,
    border: "2px dashed rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "rgba(255,255,255,0.22)", fontSize: 24, flexShrink: 0,
    cursor: "pointer", userSelect: "none",
  },
  wonOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
  },
  wonBox: {
    background: "linear-gradient(135deg,#1a5c2a,#0f3a1a)",
    border: "2px solid rgba(255,215,0,0.6)", borderRadius: 20,
    padding: "40px 60px", textAlign: "center", color: "#ffd700",
    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
  },
};

// ─── Card rendering ───────────────────────────────────────────────────────────
function CardFace({ card, selected }) {
  const red = isRed(card.suit);
  const color = red ? "#c0392b" : "#1c1c2e";
  return (
    <div style={{
      width: CARD_W, height: CARD_H, borderRadius: 8,
      background: "#fefdf8",
      border: selected ? "2.5px solid #ffd700" : "1.5px solid #bbb",
      boxShadow: selected ? "0 0 0 2px #ffd700, 0 4px 18px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.35)",
      position: "relative", flexShrink: 0, userSelect: "none",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: "3px 5px", overflow: "hidden",
    }}>
      {/* Top-left corner */}
      <div style={{ color, fontSize: 12, fontWeight: "bold", lineHeight: 1.2 }}>
        <div>{card.rank}</div>
        <div style={{ fontSize: 11 }}>{card.suit}</div>
      </div>
      {/* Center suit */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        fontSize: 30, opacity: 0.12, color,
      }}>{card.suit}</div>
      {/* Bottom-right corner — use separate divs, NOT CSS rotate */}
      <div style={{ color, fontSize: 12, fontWeight: "bold", lineHeight: 1.2, alignSelf: "flex-end", textAlign: "right" }}>
        <div>{card.suit}</div>
        <div style={{ fontSize: 11 }}>{card.rank}</div>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div style={{
      width: CARD_W, height: CARD_H, borderRadius: 8,
      background: "linear-gradient(135deg,#1a3a8a 0%,#0f2060 50%,#1a3a8a 100%)",
      border: "1.5px solid rgba(255,255,255,0.15)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      position: "relative", flexShrink: 0, overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 5, borderRadius: 5,
        background: "repeating-linear-gradient(45deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 2px,transparent 2px,transparent 8px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }} />
    </div>
  );
}

// ─── Clickable card wrapper ───────────────────────────────────────────────────
function Card({ card, selected, onClick, onDoubleClick }) {
  if (!card.faceUp) return (
    <div onClick={onClick} style={{ cursor: "default" }}>
      <CardBack />
    </div>
  );
  return (
    <div onClick={onClick} onDoubleClick={onDoubleClick} style={{ cursor: "pointer" }}>
      <CardFace card={card} selected={selected} />
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function Solitaire() {
  const [G, setG] = useState(() => initGame());
  const [history, setHistory] = useState([]);
  const { tableau, stock, waste, foundations, selected, moves } = G;

  const update = fn => {
    setG(prev => {
      const next = fn(prev);
      if (next.moves !== prev.moves) {
        setHistory(h => [...h, { ...prev, selected: null }]);
      }
      return next;
    });
  };

  const undo = () => {
    setHistory(h => {
      if (!h.length) return h;
      setG({ ...h[h.length - 1], selected: null });
      return h.slice(0, -1);
    });
  };

  const clearSel = s => ({ ...s, selected: null });

  // ── Stock click ──
  const onStock = () => update(prev => {
    if (prev.stock.length === 0) {
      if (!prev.waste.length) return prev;
      return { ...prev, stock: [...prev.waste].reverse().map(c => ({ ...c, faceUp: false })), waste: [], selected: null };
    }
    const drawn = { ...prev.stock[prev.stock.length - 1], faceUp: true };
    return { ...prev, stock: prev.stock.slice(0, -1), waste: [...prev.waste, drawn], selected: null };
  });

  // ── Waste click ──
  const onWaste = () => update(prev => {
    if (!prev.waste.length) return prev;
    if (prev.selected?.source === "waste") return clearSel(prev);
    const card = prev.waste[prev.waste.length - 1];
    return { ...prev, selected: { source: "waste", card } };
  });

  // ── Foundation click ──
  const onFoundation = fi => update(prev => {
    const { selected: sel } = prev;
    if (!sel) return prev;
    const card = sel.card;
    if (!canFoundation(card, prev.foundations[fi])) return clearSel(prev);

    const newF = prev.foundations.map(f => [...f]);
    newF[fi] = [...newF[fi], card];
    let newWaste = [...prev.waste];
    let newTab   = prev.tableau.map(c => [...c]);

    if (sel.source === "waste") {
      newWaste = newWaste.slice(0, -1);
    } else {
      const srcCol = prev.tableau[sel.colIdx];
      if (srcCol.length - sel.cardIdx > 1) return clearSel(prev);
      newTab[sel.colIdx] = flipTop(newTab[sel.colIdx].slice(0, -1));
    }
    const next = { ...prev, foundations: newF, waste: newWaste, tableau: newTab, selected: null, moves: prev.moves + 1 };
    return { ...next, won: won(next.foundations) };
  });

  // ── Tableau card click ──
  const onTableauCard = (colIdx, cardIdx) => update(prev => {
    const column  = prev.tableau[colIdx];
    const card    = column[cardIdx];
    const isTop   = cardIdx === column.length - 1;
    const { selected: sel } = prev;

    // Face-down top card → flip it
    if (!card.faceUp) {
      if (!isTop) return prev;
      const newTab = prev.tableau.map(c => [...c]);
      newTab[colIdx] = [...newTab[colIdx].slice(0, -1), { ...card, faceUp: true }];
      return { ...prev, tableau: newTab, selected: null, moves: prev.moves + 1 };
    }

    // Something is selected → try to place on this card
    if (sel) {
      // Placement must be on the TOP card of the target column
      if (!isTop) {
        // Clicked a buried card — reselect if same color rules allow, else clear
        if (sel.source === "tableau" && sel.colIdx === colIdx) return clearSel(prev);
        // Select new stack from this card if it's face-up
        return { ...prev, selected: { source: "tableau", colIdx, cardIdx, card } };
      }

      const newTab = prev.tableau.map(c => [...c]);
      let newWaste = [...prev.waste];

      if (sel.source === "tableau") {
        const cards = prev.tableau[sel.colIdx].slice(sel.cardIdx);
        if (sel.colIdx === colIdx) return clearSel(prev);
        if (!canTableau(cards[0], column)) return clearSel(prev);
        newTab[sel.colIdx] = flipTop(newTab[sel.colIdx].slice(0, sel.cardIdx));
        newTab[colIdx]     = [...prev.tableau[colIdx], ...cards];  // use prev, not newTab, to avoid cross-mutation
      } else if (sel.source === "waste") {
        if (!canTableau(sel.card, column)) return clearSel(prev);
        newTab[colIdx] = [...newTab[colIdx], sel.card];
        newWaste       = newWaste.slice(0, -1);
      } else {
        return clearSel(prev);
      }
      return { ...prev, tableau: newTab, waste: newWaste, selected: null, moves: prev.moves + 1 };
    }

    // Nothing selected → select this card (and stack below it)
    return { ...prev, selected: { source: "tableau", colIdx, cardIdx, card } };
  });

  // ── Empty tableau column click ──
  const onEmptyCol = colIdx => update(prev => {
    const { selected: sel } = prev;
    if (!sel) return prev;
    const newTab   = prev.tableau.map(c => [...c]);
    let   newWaste = [...prev.waste];

    if (sel.source === "waste") {
      if (sel.card.rank !== "K") return clearSel(prev);
      newTab[colIdx] = [sel.card];
      newWaste       = newWaste.slice(0, -1);
    } else if (sel.source === "tableau") {
      const cards = prev.tableau[sel.colIdx].slice(sel.cardIdx);
      if (sel.colIdx === colIdx) return clearSel(prev);
      if (cards[0].rank !== "K") return clearSel(prev);
      newTab[sel.colIdx] = flipTop(newTab[sel.colIdx].slice(0, sel.cardIdx));
      newTab[colIdx]     = [...cards];
    } else return clearSel(prev);

    return { ...prev, tableau: newTab, waste: newWaste, selected: null, moves: prev.moves + 1 };
  });

  // ── Double-click → auto-foundation ──
  const onDblClick = (source, colIdx) => update(prev => {
    let card;
    let newTab   = prev.tableau.map(c => [...c]);
    let newWaste = [...prev.waste];

    if (source === "waste") {
      if (!prev.waste.length) return prev;
      card     = prev.waste[prev.waste.length - 1];
      newWaste = newWaste.slice(0, -1);
    } else {
      const col = prev.tableau[colIdx];
      if (!col.length) return prev;
      card = col[col.length - 1];
      if (!card.faceUp) return prev;
      newTab[colIdx] = flipTop(newTab[colIdx].slice(0, -1));
    }

    const fi = suitIdx(card.suit);
    if (!canFoundation(card, prev.foundations[fi])) return source === "waste" ? prev : prev; // no-op

    const newF = prev.foundations.map(f => [...f]);
    newF[fi]   = [...newF[fi], card];
    const next = { ...prev, foundations: newF, waste: newWaste, tableau: newTab, selected: null, moves: prev.moves + 1 };
    return { ...next, won: won(next.foundations) };
  });

  const wasteTop     = waste.length ? waste[waste.length - 1] : null;
  const wasteSelctd  = selected?.source === "waste";

  return (
    <div
      style={S.root}
      onClick={() => setG(p => p.selected ? clearSel(p) : p)}
    >
      {/* ── Win overlay ── */}
      {G.won && (
        <div style={S.wonOverlay}>
          <div style={S.wonBox}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 30, fontWeight: "bold", marginBottom: 6 }}>You Win!</div>
            <div style={{ color: "#c8f0c8", fontSize: 14, marginBottom: 24 }}>Completed in {moves} moves</div>
            <button style={{ ...S.newBtn, fontSize: 15, padding: "10px 32px" }} onClick={() => { setG(initGame()); setHistory([]); }}>
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={S.topBar} onClick={e => e.stopPropagation()}>
        <div style={S.pill}>♠ Solitaire</div>
        <div style={S.pill}>Moves: {moves}</div>
        <button
          style={{ ...S.newBtn, opacity: history.length ? 1 : 0.35, cursor: history.length ? "pointer" : "default" }}
          onClick={undo}
          disabled={!history.length}
        >↩ Undo</button>
        <button style={S.newBtn} onClick={() => { setG(initGame()); setHistory([]); }}>New Game</button>
      </div>

      <div style={S.area} onClick={e => e.stopPropagation()}>

        {/* ── Top row: stock | waste | gap | 4 foundations ── */}
        <div style={S.topRow}>

          {/* Stock */}
          <div
            onClick={onStock}
            style={{ ...S.emptySlot, background: stock.length ? "linear-gradient(135deg,#1a3a8a,#0f2060)" : "rgba(0,0,0,0.12)", cursor: "pointer", position: "relative", overflow: "hidden" }}
          >
            {stock.length > 0
              ? <div style={{ position: "absolute", inset: 5, borderRadius: 5, background: "repeating-linear-gradient(45deg,rgba(255,255,255,0.07) 0,rgba(255,255,255,0.07) 2px,transparent 2px,transparent 8px)", border: "1px solid rgba(255,255,255,0.08)" }} />
              : <span style={{ fontSize: 26, opacity: 0.4 }}>↩</span>
            }
          </div>

          {/* Waste */}
          {wasteTop ? (
            <div onClick={e => { e.stopPropagation(); onWaste(); }} onDoubleClick={e => { e.stopPropagation(); onDblClick("waste"); }}>
              <CardFace card={wasteTop} selected={wasteSelctd} />
            </div>
          ) : (
            <div style={S.emptySlot} />
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Foundations */}
          {foundations.map((pile, fi) => {
            const top = pile.length ? pile[pile.length - 1] : null;
            return (
              <div key={fi} onClick={e => { e.stopPropagation(); onFoundation(fi); }}>
                {top
                  ? <CardFace card={top} selected={false} />
                  : <div style={{ ...S.emptySlot, cursor: "pointer" }}>{SUITS[fi]}</div>
                }
              </div>
            );
          })}
        </div>

        {/* ── Tableau ── */}
        <div style={S.tableauRow}>
          {tableau.map((col, colIdx) => {
            const height = colHeight(col);
            return (
              <div
                key={colIdx}
                style={{ position: "relative", width: CARD_W, height: Math.max(height, CARD_H), flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); if (!col.length) onEmptyCol(colIdx); }}
              >
                {col.length === 0
                  ? <div style={{ ...S.emptySlot, position: "absolute", top: 0, left: 0, cursor: "pointer" }}>K</div>
                  : col.map((card, cardIdx) => {
                      const topPx   = cardTop(col, cardIdx);
                      const isSel   = selected?.source === "tableau" && selected.colIdx === colIdx && cardIdx >= selected.cardIdx;
                      const isTop   = cardIdx === col.length - 1;
                      // Hit area height: for non-top cards, only the visible peek strip is clickable
                      const nextTop = isTop ? null : cardTop(col, cardIdx + 1);
                      const hitH    = isTop ? CARD_H : (nextTop - topPx);
                      return (
                        <div
                          key={card.id}
                          style={{ position: "absolute", top: topPx, left: 0, zIndex: cardIdx + 1 }}
                        >
                          {/* Transparent hit-area overlay sized to visible peek strip only */}
                          <div
                            style={{ position: "absolute", top: 0, left: 0, width: CARD_W, height: hitH, zIndex: 10, cursor: card.faceUp ? "pointer" : "default" }}
                            onClick={e => { e.stopPropagation(); onTableauCard(colIdx, cardIdx); }}
                            onDoubleClick={isTop && card.faceUp ? e => { e.stopPropagation(); onDblClick("tableau", colIdx); } : undefined}
                          />
                          <Card card={card} selected={isSel} />
                        </div>
                      );
                    })
                }
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "16px auto 0", textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: 11.5, lineHeight: 2 }}>
        Click to select · Click destination to place · Double-click top card → foundation · Click stock to draw
      </div>
    </div>
  );
}