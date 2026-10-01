import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistentState } from "../../../Utils/usePersistentState";
import { loadCache } from "./db";
import { syncBank } from "./sync";
import { isRemoteConfigured } from "./remote";
import { buildCategoryTree, countBySubtree } from "./categories";
import { withAttempt, withFlag } from "./progress";
import { timeAgo } from "./format";
import BrowsePanel from "./components/BrowsePanel";
import StudyPanel from "./components/StudyPanel";
import ExamPanel from "./components/ExamPanel";
import StatsPanel from "./components/StatsPanel";

// Read-only question bank backed by Supabase. Questions are cached in
// IndexedDB (db.js) and refreshed by the Sync button; personal data —
// favorites, right/wrong records, exam history — stays in localStorage.

const TABS = [
  { id: "browse", label: "Browse" },
  { id: "study", label: "Study" },
  { id: "exam", label: "Exam" },
  { id: "stats", label: "Stats" },
];
const HISTORY_LIMIT = 50;

function buildBank({ categories, questions }) {
  const sorted = [...questions].sort((a, b) => a.id - b.id);
  return {
    categories,
    questions: sorted,
    catById: new Map(categories.map(c => [c.id, c])),
    questionsById: new Map(sorted.map(q => [q.id, q])),
    counts: countBySubtree(categories, sorted),
    tree: buildCategoryTree(categories),
    tags: [...new Set(sorted.flatMap(q => q.tags))].sort((a, b) => a.localeCompare(b)),
  };
}

function describeSync({ questions: q, categories: c }) {
  const parts = [];
  if (q.added) parts.push(`${q.added} new`);
  if (q.updated) parts.push(`${q.updated} updated`);
  if (q.removed) parts.push(`${q.removed} removed`);
  const catChanges = c.added + c.updated + c.removed;
  if (parts.length === 0 && catChanges === 0) return "Already up to date.";
  return [
    parts.length ? `Questions: ${parts.join(", ")}.` : "",
    catChanges ? `${catChanges} categor${catChanges === 1 ? "y" : "ies"} changed.` : "",
  ].filter(Boolean).join(" ");
}

export default function QuestionBank() {
  const [cache, setCache] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [sync, setSync] = useState({ busy: false, message: "", error: false });
  const [storedTab, setActiveTab] = usePersistentState("tool:question_bank:tab", "browse");
  const activeTab = TABS.some(t => t.id === storedTab) ? storedTab : "browse";
  const [progress, setProgress] = usePersistentState("tool:question_bank:progress", {}, { debounceMs: 0 });
  const [history, setHistory] = usePersistentState("tool:question_bank:exam-history", [], { debounceMs: 0 });

  const runSync = useCallback(async () => {
    setSync({ busy: true, message: "Syncing…", error: false });
    try {
      const summary = await syncBank();
      setCache(await loadCache());
      setSync({ busy: false, message: describeSync(summary), error: false });
    } catch (e) {
      setSync({ busy: false, message: `Sync failed: ${e.message}`, error: true });
    }
  }, []);

  // Open the local cache; the very first visit (nothing cached yet) syncs automatically.
  useEffect(() => {
    let cancelled = false;
    loadCache()
      .then(c => {
        if (cancelled) return;
        setCache(c);
        if (!c.meta.lastSyncedAt && isRemoteConfigured) runSync();
      })
      .catch(e => !cancelled && setLoadError(e.message));
    return () => { cancelled = true; };
  }, [runSync]);

  // Re-render the "synced N min ago" label once a minute.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const bank = useMemo(() => (cache ? buildBank(cache) : null), [cache]);

  const actions = useMemo(() => ({
    recordAttempt: (id, correct) => setProgress(p => withAttempt(p, id, correct)),
    toggleFavorite: id => setProgress(p => withFlag(p, id, "fav")),
    markRead: id => setProgress(p => withFlag(p, id, "read", true)),
    resetProgress: () => setProgress({}),
    clearHistory: () => setHistory([]),
  }), [setProgress, setHistory]);

  const recordExam = useCallback(
    entry => setHistory(h => [entry, ...h.filter(e => e.id !== entry.id)].slice(0, HISTORY_LIMIT)),
    [setHistory]
  );

  if (loadError) {
    return <div className="tk-qb-root"><div className="tk-error">Couldn&apos;t open local storage: {loadError}</div></div>;
  }
  if (!bank) {
    return <div className="tk-qb-root"><p className="tk-qb-tree-empty">Loading question bank…</p></div>;
  }

  const lastSyncedAt = cache.meta.lastSyncedAt;
  const isEmpty = bank.questions.length === 0;

  return (
    <div className="tk-qb-root">
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Question Bank</h2>
        <div className="tk-qb-syncbar">
          <span className="tk-qb-note">
            {bank.questions.length} questions · {lastSyncedAt ? `synced ${timeAgo(lastSyncedAt)}` : "never synced"}
          </span>
          <button
            className="tk-action-btn"
            onClick={runSync}
            disabled={sync.busy || !isRemoteConfigured}
            title={isRemoteConfigured ? "Pull the latest questions" : "Supabase isn't configured"}
          >
            {sync.busy ? "Syncing…" : "⟳ Sync"}
          </button>
        </div>
      </div>
      {sync.message && !sync.busy && (
        <p className={sync.error ? "tk-error" : "tk-qb-note"}>{sync.message}</p>
      )}
      {!isRemoteConfigured && (
        <div className="tk-error">
          Supabase isn&apos;t configured — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
        </div>
      )}

      {isEmpty ? (
        <p className="tk-qb-tree-empty">
          {sync.busy ? "Downloading questions…" : "No questions cached yet — press Sync to download them."}
        </p>
      ) : (
        <>
          <div className="tk-qb-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tk-qb-tab${activeTab === t.id ? " tk-active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "browse" && <BrowsePanel bank={bank} progress={progress} actions={actions} />}
          {activeTab === "study" && <StudyPanel bank={bank} progress={progress} actions={actions} />}
          {activeTab === "exam" && (
            <ExamPanel bank={bank} progress={progress} actions={actions} onExamFinished={recordExam} />
          )}
          {activeTab === "stats" && (
            <StatsPanel bank={bank} progress={progress} history={history} actions={actions} />
          )}
        </>
      )}
    </div>
  );
}
