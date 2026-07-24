import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import PROBLEMS from "../../Helper/problems";
import { runFunctionAgainstInputs } from "../../Helper/sandboxedRunner";
import { deepEqual } from "../../Helper/deepEqual";
import { getSavedCode, saveCode, getSolvedSet, markSolved } from "../../Helper/practiceStorage";
import { Toast, showToast } from "../../Utils/Toast";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

const SearchIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

function fmtValue(v) {
  if (v === undefined) return "undefined";
  try { return JSON.stringify(v); } catch { return String(v); }
}

export default function PracticeTool() {
  const [query, setQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState(null);
  const [activeId, setActiveId] = useState(PROBLEMS[0]?.id ?? null);
  const [solved, setSolved] = useState(() => getSolvedSet());
  const [results, setResults] = useState(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState(null);

  const editorRef = useRef(null);
  const editorViewRef = useRef(null);
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const problem = PROBLEMS.find(p => p.id === activeId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROBLEMS.filter(p => {
      if (difficultyFilter && p.difficulty !== difficultyFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.tags.some(t => t.includes(q))) return false;
      return true;
    });
  }, [query, difficultyFilter]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map();
    for (const p of filtered) {
      if (!groups.has(p.category)) groups.set(p.category, []);
      groups.get(p.category).push(p);
    }
    return [...groups.entries()];
  }, [filtered]);

  useEffect(() => {
    if (!editorRef.current || !problem) return;
    const initialCode = getSavedCode(problem.id) || problem.starterCode;
    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        javascript(),
        EditorView.lineWrapping,
        oneDark,
        EditorView.updateListener.of(update => {
          if (update.docChanged) saveCode(activeIdRef.current, update.state.doc.toString());
        }),
      ],
    });
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }
    const view = new EditorView({ state, parent: editorRef.current });
    editorViewRef.current = view;
    setResults(null);
    setGradeError(null);

    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, [problem?.id]);

  const runTests = useCallback(async () => {
    if (!problem || !editorViewRef.current || grading) return;
    setGrading(true);
    setResults(null);
    setGradeError(null);

    const code = editorViewRef.current.state.doc.toString();
    const argsList = problem.testCases.map(tc => tc.args);
    const { results: raw, gradeError: gErr } = await runFunctionAgainstInputs(code, problem.functionName, argsList);

    setGrading(false);

    if (gErr) {
      setGradeError(gErr);
      showToast(gErr, "error");
      return;
    }

    const cases = problem.testCases.map((tc, i) => {
      const r = raw[i] ?? {};
      const passed = !r.error && deepEqual(r.actual, tc.expected);
      return { args: tc.args, expected: tc.expected, actual: r.actual, error: r.error, passed };
    });
    const passedCount = cases.filter(c => c.passed).length;
    setResults({ passed: passedCount, total: cases.length, cases });

    if (passedCount === cases.length) {
      markSolved(problem.id);
      setSolved(getSolvedSet());
      showToast(`All ${cases.length} tests passed!`, "success");
    } else {
      showToast(`${passedCount}/${cases.length} tests passed`, "warning");
    }
  }, [problem, grading]);

  return (
    <>
      <Toast />
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Practice</h2>
        <div className="tk-tool-actions">
          <span style={{ fontSize: "0.65rem", color: "var(--tk-text-dim)", letterSpacing: "0.06em" }}>
            {solved.size}/{PROBLEMS.length} solved
          </span>
        </div>
      </div>

      <div className="pr-layout">
        <aside className="pr-list">
          <div className="pr-list-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search problems…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pr-list-search-input"
            />
          </div>
          <div className="pr-list-filters">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                className={`pr-filter-chip${difficultyFilter === d ? " pr-filter-chip--active" : ""}`}
                onClick={() => setDifficultyFilter(f => f === d ? null : d)}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="pr-list-count">{filtered.length} problem{filtered.length === 1 ? "" : "s"}</div>
          <div className="pr-list-items">
            {groupedByCategory.map(([category, probs]) => (
              <div key={category}>
                <span className="tk-sidebar-group-label">{category}</span>
                {probs.map(p => (
                  <button
                    key={p.id}
                    className={`pr-list-item${p.id === activeId ? " pr-list-item--active" : ""}`}
                    onClick={() => setActiveId(p.id)}
                  >
                    {solved.has(p.id) && <span className="pr-solved-mark">✓</span>}
                    <span className="pr-list-item-title">{p.title}</span>
                    <span className={`pr-diff-badge pr-diff-badge--${p.difficulty}`}>{p.difficulty}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <main className="pr-main">
          {!problem ? (
            <div className="pr-description">No problem selected.</div>
          ) : (
            <>
              <div className="pr-header">
                <h3 className="pr-title">{problem.title}</h3>
                <span className={`pr-diff-badge pr-diff-badge--${problem.difficulty}`}>{problem.difficulty}</span>
                <div className="pr-tags">
                  {problem.tags.map(t => <span key={t} className="pr-tag">{t}</span>)}
                </div>
              </div>

              <div className="pr-description">{problem.description}</div>

              <div className="pr-editor-wrap">
                <div ref={editorRef} className="pr-editor cm-editor-container" />
              </div>

              <div className="pr-actions">
                <button className="tk-action-btn" onClick={runTests} disabled={grading}
                  style={{ background: grading ? "var(--tk-surface2)" : "var(--tk-accent)", color: grading ? "var(--tk-text-dim)" : "var(--tk-bg)", fontWeight: 700 }}>
                  {grading ? "Running…" : "▶ Run Tests"}
                </button>
              </div>

              {gradeError && <div className="pr-grade-error">{gradeError}</div>}

              {results && (
                <div className="pr-results">
                  <div className="pr-results-summary">{results.passed}/{results.total} test cases passed</div>
                  {results.cases.map((c, i) => (
                    <div key={i} className={`pr-case ${c.passed ? "pr-case--pass" : "pr-case--fail"}`}>
                      <div>{c.passed ? "✓" : "✗"} Test {i + 1} — args: {fmtValue(c.args)}</div>
                      {!c.passed && (
                        <div className="pr-case-detail">
                          expected: {fmtValue(c.expected)} · got: {c.error ? `error: ${c.error}` : fmtValue(c.actual)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
