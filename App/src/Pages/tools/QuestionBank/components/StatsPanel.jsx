import { useMemo, useState } from "react";
import { ConfirmModal } from "../../../../Utils/Modal";
import { collectSubtreeIds } from "../categories";
import { getEntry, isFavorite, isWrong } from "../progress";
import { formatDuration, timeAgo } from "../format";

// Everything here is derived from local progress + exam history; nothing is
// sent anywhere.
export default function StatsPanel({ bank, progress, history, actions }) {
  const [confirm, setConfirm] = useState(null); // "progress" | "history"

  const stats = useMemo(() => {
    const entries = bank.questions.map(q => ({ question: q, entry: getEntry(progress, q.id) }));
    const attempted = entries.filter(e => e.entry.shown > 0);
    const shown = attempted.reduce((n, e) => n + e.entry.shown, 0);
    const correct = attempted.reduce((n, e) => n + e.entry.correct, 0);

    // Ranked by wrong-rate so 3/3 wrong beats 3/10 wrong; raw count breaks ties.
    const mostWrong = attempted
      .filter(e => e.entry.wrong > 0)
      .sort((a, b) =>
        b.entry.wrong / b.entry.shown - a.entry.wrong / a.entry.shown || b.entry.wrong - a.entry.wrong
      )
      .slice(0, 15);

    // Coverage = share of each top-level category you've attempted or read.
    const coverage = bank.tree
      .filter(root => bank.counts.get(root.id))
      .map(root => {
        const ids = collectSubtreeIds(bank.categories, root.id);
        const inRoot = entries.filter(e => ids.has(e.question.categoryId));
        const covered = inRoot.filter(e => e.entry.shown > 0 || e.entry.read).length;
        return { category: root, total: inRoot.length, covered };
      });

    return {
      attempted: attempted.length,
      accuracy: shown ? Math.round((correct / shown) * 100) : null,
      favorites: entries.filter(e => isFavorite(e.entry)).length,
      stillWrong: entries.filter(e => isWrong(e.entry)).length,
      mostWrong,
      coverage,
    };
  }, [bank, progress]);

  return (
    <div className="tk-qb-stats">
      <div className="tk-qb-tiles">
        <div className="tk-qb-tile"><strong>{bank.questions.length}</strong><span>questions</span></div>
        <div className="tk-qb-tile"><strong>{stats.attempted}</strong><span>attempted</span></div>
        <div className="tk-qb-tile"><strong>{stats.accuracy == null ? "—" : `${stats.accuracy}%`}</strong><span>accuracy</span></div>
        <div className="tk-qb-tile"><strong>{stats.favorites}</strong><span>favorites</span></div>
        <div className="tk-qb-tile"><strong>{stats.stillWrong}</strong><span>still wrong</span></div>
      </div>

      <section>
        <h3 className="tk-pane-label">MOST WRONG ANSWERED</h3>
        {stats.mostWrong.length === 0 ? (
          <p className="tk-qb-tree-empty">No wrong answers yet — attempt some questions in Study or Exam.</p>
        ) : (
          <div className="tk-qb-question-list">
            {stats.mostWrong.map(({ question, entry }) => (
              <div key={question.id} className="tk-qb-stats-row">
                <span className="tk-qb-question-text">{question.questionText}</span>
                <span className="tk-qb-badge tk-qb-badge--warn">
                  {entry.wrong}/{entry.shown} wrong ({Math.round((entry.wrong / entry.shown) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="tk-pane-label">CATEGORY COVERAGE</h3>
        {stats.coverage.length === 0 ? (
          <p className="tk-qb-tree-empty">No questions yet.</p>
        ) : (
          <div className="tk-qb-coverage-list">
            {stats.coverage.map(({ category, total, covered }) => (
              <div key={category.id} className="tk-qb-coverage-row">
                <span className="tk-qb-coverage-label" title={category.name}>{category.name}</span>
                <div className="tk-qb-coverage-bar">
                  <div className="tk-qb-coverage-bar-fill" style={{ width: `${Math.round((covered / total) * 100)}%` }} />
                </div>
                <span className="tk-qb-coverage-count">{covered}/{total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="tk-pane-label">EXAM HISTORY</h3>
        {history.length === 0 ? (
          <p className="tk-qb-tree-empty">No exams taken yet.</p>
        ) : (
          <div className="tk-qb-question-list">
            {history.map(h => (
              <div key={h.id} className="tk-qb-stats-row">
                <span className="tk-qb-history-label">
                  {h.label}
                  <span className="tk-qb-note">{timeAgo(h.at)} · {formatDuration(h.durationMs)}</span>
                </span>
                <span className={`tk-qb-badge ${h.percent >= 50 ? "tk-qb-badge--ok" : "tk-qb-badge--warn"}`}>
                  {h.correct}/{h.total} · {h.percent}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="tk-qb-study-actions">
        <button className="tk-action-btn tk-danger" disabled={history.length === 0} onClick={() => setConfirm("history")}>
          Clear exam history
        </button>
        <button className="tk-action-btn tk-danger" onClick={() => setConfirm("progress")}>
          Reset all progress
        </button>
      </div>

      <ConfirmModal
        isOpen={confirm != null}
        title={confirm === "progress" ? "Reset all progress?" : "Clear exam history?"}
        message={
          confirm === "progress"
            ? "Favorites, read marks and every right/wrong record on this device will be erased. Questions themselves are not affected."
            : "All saved exam results on this device will be erased."
        }
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === "progress" ? actions.resetProgress() : actions.clearHistory())}
        danger
      />
    </div>
  );
}
