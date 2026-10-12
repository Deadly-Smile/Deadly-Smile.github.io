import { useEffect } from "react";
import { currentHandLabel, potOddsNeeded, adviceFor, pct, CATEGORY_NAMES } from "./odds";

// Beginner-facing odds UI: a one-line badge above the action bar and a
// pop-up with the full breakdown. All numbers come from odds.js using only
// the viewer's own hole cards and the board.

const VERDICT_STYLE = {
  fold: "text-red-300",
  call: "text-sky-300",
  check: "text-slate-300",
  raise: "text-emerald-300",
};

export function OddsBadge({ hole, board, odds, opponents, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="w-full mb-1.5 px-3 py-1 rounded-full bg-black/40 border border-emerald-400/30 text-[11px] sm:text-xs text-slate-200 hover:border-emerald-300 transition-colors flex items-center justify-center gap-2 flex-wrap"
      title="Open the odds helper"
    >
      <span className="font-semibold text-white">{currentHandLabel(hole, board)}</span>
      <span className="text-slate-500">·</span>
      {odds
        ? <span>Win ≈ <span className="font-mono text-emerald-300">{pct(odds.equity)}</span> vs {opponents}</span>
        : <span className="text-slate-500">calculating…</span>}
      <span className="text-slate-500">·</span>
      <span className="underline decoration-dotted">📊 details</span>
    </button>
  );
}

function Bar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-slate-400">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-10 text-right font-mono">{pct(value)}</span>
    </div>
  );
}

const RANKING_EXAMPLES = [
  "A♠ K♠ Q♠ J♠ 10♠", "9♥ 9♦ 9♣ 9♠ K♦", "Q♣ Q♦ Q♥ 7♠ 7♦", "A♦ J♦ 8♦ 5♦ 2♦", "8♠ 7♥ 6♦ 5♣ 4♠",
  "J♣ J♦ J♥ 9♠ 3♦", "K♠ K♥ 6♦ 6♣ A♥", "10♥ 10♣ 8♦ 4♠ 2♣", "A♣ Q♦ 9♠ 6♥ 3♣",
];

export function OddsModal({ hole, board, odds, opponents, toCall, pot, showBadge, onToggleBadge, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needed = potOddsNeeded(toCall, pot);
  const advice = odds ? adviceFor({ equity: odds.equity, toCall, pot, opponents }) : null;
  const handInProgress = hole.length === 2;
  // Strongest hands first, like a printed rankings card.
  const categories = CATEGORY_NAMES.map((name, i) => ({ name, i, example: RANKING_EXAMPLES[8 - i] })).reverse();

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Odds helper"
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-5 text-white"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">📊 Your chances</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none" aria-label="Close">✕</button>
        </div>

        {!handInProgress ? (
          <p className="text-sm text-slate-400 mb-4">You&apos;re not in a hand right now. Odds appear once you&apos;re dealt cards.</p>
        ) : opponents === 0 ? (
          <p className="text-sm text-slate-400 mb-4">Everyone else folded — the pot is yours.</p>
        ) : (
          <>
            <p className="text-sm mb-1">
              You have <span className="font-semibold text-amber-300">{currentHandLabel(hole, board)}</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Against {opponents} opponent{opponents === 1 ? "" : "s"} still in the hand, simulated over {odds ? odds.iterations.toLocaleString() : "…"} random run-outs.
            </p>

            {odds ? (
              <>
                <div className="space-y-1.5 mb-4">
                  <Bar label="Win" value={odds.win} color="bg-emerald-500" />
                  <Bar label="Split" value={odds.tie} color="bg-amber-400" />
                  <Bar label="Lose" value={odds.lose} color="bg-red-500" />
                </div>

                <div className="rounded-xl bg-slate-800 border border-slate-700 p-3 mb-4 text-sm">
                  {toCall > 0 ? (
                    <p className="mb-1">
                      To call <span className="font-mono">${toCall}</span> into a <span className="font-mono">${pot}</span> pot you need to win
                      at least <span className="font-mono text-sky-300">{pct(needed)}</span> of the time.
                    </p>
                  ) : (
                    <p className="mb-1 text-slate-300">Nobody has bet — you can check for free.</p>
                  )}
                  <p className={VERDICT_STYLE[advice.verdict]}>💡 {advice.text}</p>
                </div>

                {board.length < 5 && (
                  <>
                    <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-1.5">By the river you&apos;ll have…</h3>
                    <table className="w-full text-xs mb-4">
                      <tbody>
                        {categories.filter(c => odds.categories[c.i] > 0).map(c => (
                          <tr key={c.i} className="border-b border-slate-800">
                            <td className="py-1">{c.name}</td>
                            <td className="py-1 text-right font-mono">{pct(odds.categories[c.i])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 mb-4">Calculating…</p>
            )}
          </>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-slate-300 mb-1.5">🃏 Hand rankings (best to worst)</summary>
          <ol className="space-y-1">
            {categories.map(c => (
              <li key={c.i} className="flex justify-between gap-2">
                <span>{c.name}</span>
                <span className="font-mono text-slate-400">{c.example}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-slate-500">
            You make your best 5-card hand from your 2 cards plus the 5 on the table.
          </p>
        </details>

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={showBadge} onChange={e => onToggleBadge(e.target.checked)} />
          Show my chances above the action buttons
        </label>
      </div>
    </div>
  );
}
