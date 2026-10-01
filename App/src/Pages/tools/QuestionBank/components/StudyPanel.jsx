import { useMemo } from "react";
import { usePersistentState } from "../../../../Utils/usePersistentState";
import { DEFAULT_FILTER, filterPool, sanitizeFilter, shuffle, isCorrectAnswer } from "../examBuilder";
import { getEntry } from "../progress";
import QuestionFilterPicker from "./QuestionFilterPicker";
import AnswerControls from "./AnswerControls";
import { QuestionMeta, QuestionPrompt } from "./QuestionContent";

// Flashcard-style practice: one question at a time, answer, move on.
// Filter, order and position survive leaving the tool.
export default function StudyPanel({ bank, progress, actions }) {
  const [state, setState] = usePersistentState("tool:question_bank:study", {
    filter: DEFAULT_FILTER, order: null, index: 0,
  });
  const filter = sanitizeFilter(state.filter, bank.catById, bank.tags);
  const filterKey = JSON.stringify(filter);

  // The pool is re-filtered when the filter or the bank changes, not on every
  // answer — otherwise answering in "Not seen yet" mode would pull the card
  // out from under you. progress is deliberately left out of the deps.
  const pool = useMemo(
    () => filterPool(bank.questions, bank.categories, progress, filter),
    [bank, filterKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // `order` is a shuffled id list; ids no longer in the pool are skipped and
  // new ones appended, so a sync doesn't reset a shuffled session.
  const deck = useMemo(() => {
    if (!state.order) return pool;
    const byId = new Map(pool.map(q => [q.id, q]));
    const ordered = state.order.map(id => byId.get(id)).filter(Boolean);
    const inOrder = new Set(state.order);
    return [...ordered, ...pool.filter(q => !inOrder.has(q.id))];
  }, [pool, state.order]);

  const index = Math.min(state.index, Math.max(0, deck.length - 1));
  const current = deck[index];

  const setFilter = f => setState({ filter: f, order: null, index: 0 });
  const go = i => setState(s => ({ ...s, index: Math.max(0, Math.min(i, deck.length - 1)) }));
  const toggleShuffle = () =>
    setState(s => ({ ...s, index: 0, order: s.order ? null : shuffle(pool.map(q => q.id)) }));

  return (
    <div className="tk-qb-study">
      <QuestionFilterPicker bank={bank} filter={filter} onChange={setFilter} poolSize={pool.length} />

      {!current ? (
        <p className="tk-qb-tree-empty">No questions match this filter.</p>
      ) : (
        <>
          <div className="tk-qb-nav">
            <button className="tk-action-btn" onClick={() => go(index - 1)} disabled={index === 0}>← Prev</button>
            <span className="tk-qb-note">{index + 1} / {deck.length}</span>
            <button className="tk-action-btn" onClick={() => go(index + 1)} disabled={index >= deck.length - 1}>Next →</button>
            <button className="tk-action-btn" onClick={toggleShuffle}>{state.order ? "In order" : "Shuffle"}</button>
          </div>

          <div className="tk-qb-question-card">
            <QuestionMeta
              question={current}
              bank={bank}
              entry={getEntry(progress, current.id)}
              onToggleFavorite={actions.toggleFavorite}
            />
            <QuestionPrompt question={current} />
            <AnswerControls
              key={current.id}
              question={current}
              onAnswer={a => actions.recordAttempt(current.id, isCorrectAnswer(current, a))}
            >
              {index < deck.length - 1 && (
                <button className="tk-action-btn" onClick={() => go(index + 1)}>Next →</button>
              )}
            </AnswerControls>
          </div>
        </>
      )}
    </div>
  );
}
