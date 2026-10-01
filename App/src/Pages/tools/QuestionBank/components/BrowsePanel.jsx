import { useMemo, useState } from "react";
import { usePersistentState } from "../../../../Utils/usePersistentState";
import { filterPool, SOURCES, TYPES } from "../examBuilder";
import { getEntry } from "../progress";
import CategoryTree from "./CategoryTree";
import { QuestionMeta, QuestionPrompt, OptionList, AnswerDetails } from "./QuestionContent";

const PAGE_SIZE = 30;

function matchesSearch(q, needle) {
  if (!needle) return true;
  const haystack = [q.questionText, q.answerText, q.explanation, ...q.options.map(o => o.text), ...q.tags]
    .join("\n").toLowerCase();
  return haystack.includes(needle);
}

function BrowseCard({ question, bank, entry, actions, answersOpen }) {
  const [open, setOpen] = useState(false);
  const showAnswer = answersOpen || open;

  return (
    <div className="tk-qb-question-card">
      <QuestionMeta question={question} bank={bank} entry={entry} onToggleFavorite={actions.toggleFavorite} />
      <QuestionPrompt question={question} />
      {question.type === "mcq" && <OptionList question={question} revealed={showAnswer} />}
      {!answersOpen && (
        <button className="tk-qb-link" onClick={() => { setOpen(v => !v); if (!open) actions.markRead(question.id); }}>
          {open ? "Hide answer ▴" : "Show answer ▾"}
        </button>
      )}
      {showAnswer && <AnswerDetails question={question} />}
    </div>
  );
}

export default function BrowsePanel({ bank, progress, actions }) {
  const [state, setState] = usePersistentState("tool:question_bank:browse", {
    categoryId: null, source: "all", type: "any", answersOpen: false,
  });
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const set = patch => { setState(s => ({ ...s, ...patch })); setLimit(PAGE_SIZE); };

  // A category removed by a sync falls back to "All questions".
  const categoryId = bank.catById.has(state.categoryId) ? state.categoryId : null;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const pool = filterPool(bank.questions, bank.categories, progress, {
      categoryIds: categoryId == null ? [] : [categoryId],
      source: state.source,
      type: state.type,
    });
    return pool.filter(q => matchesSearch(q, needle));
  }, [bank, progress, categoryId, state.source, state.type, search]);

  return (
    <div className="tk-qb-browse-layout">
      <div className="tk-qb-browse-sidebar">
        <CategoryTree bank={bank} selectedId={categoryId} onSelect={id => set({ categoryId: id })} />
      </div>

      <div className="tk-qb-browse-main">
        <div className="tk-qb-toolbar">
          <input
            className="tk-input-field tk-qb-search"
            placeholder="Search questions, answers, tags…"
            value={search}
            onChange={e => { setSearch(e.target.value); setLimit(PAGE_SIZE); }}
          />
          <select className="tk-input-field" value={state.source} onChange={e => set({ source: e.target.value })}>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className="tk-input-field" value={state.type} onChange={e => set({ type: e.target.value })}>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <label className="tk-qb-check">
            <input type="checkbox" checked={state.answersOpen} onChange={e => set({ answersOpen: e.target.checked })} />
            Show all answers
          </label>
        </div>

        <p className="tk-qb-note">{visible.length} question{visible.length === 1 ? "" : "s"}</p>

        {visible.length === 0 ? (
          <p className="tk-qb-tree-empty">No questions match.</p>
        ) : (
          <div className="tk-qb-question-list">
            {visible.slice(0, limit).map(q => (
              <BrowseCard
                key={q.id}
                question={q}
                bank={bank}
                entry={getEntry(progress, q.id)}
                actions={actions}
                answersOpen={state.answersOpen}
              />
            ))}
            {visible.length > limit && (
              <button className="tk-action-btn" onClick={() => setLimit(l => l + PAGE_SIZE)}>
                Show more ({visible.length - limit} left)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
