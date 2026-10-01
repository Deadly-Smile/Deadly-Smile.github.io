import { useCallback, useEffect, useRef, useState } from "react";
import { usePersistentState } from "../../../../Utils/usePersistentState";
import {
  DEFAULT_FILTER, SOURCES, filterPool, sanitizeFilter, buildExam, gradeExam, isCorrectAnswer,
} from "../examBuilder";
import { getEntry } from "../progress";
import { formatDuration } from "../format";
import QuestionFilterPicker from "./QuestionFilterPicker";
import AnswerControls from "./AnswerControls";
import { QuestionMeta, QuestionPrompt, OptionList, AnswerDetails } from "./QuestionContent";

// config → running → done. The session is persisted, so leaving the tool (or
// reloading) mid-exam resumes where you were; the timer is an absolute
// deadline, so it keeps running while you're away.

const CONFIG_DEFAULT = { filter: DEFAULT_FILTER, count: 20, order: "random", shuffleOptions: false, timeLimitMin: 0 };

function describeFilter(filter, bank) {
  const cats = filter.categoryIds.map(id => bank.catById.get(id)?.name).filter(Boolean);
  const source = SOURCES.find(s => s.id === filter.source);
  return [
    cats.length ? cats.join(", ") : "All categories",
    filter.source !== "all" && source?.label,
  ].filter(Boolean).join(" · ");
}

// ─── Config ──────────────────────────────────────────────────────────────────

function ExamConfig({ bank, progress, config, setConfig, onStart }) {
  const pool = filterPool(bank.questions, bank.categories, progress, config.filter);
  const set = patch => setConfig(c => ({ ...c, ...patch }));

  return (
    <div className="tk-qb-exam-config">
      <QuestionFilterPicker bank={bank} filter={config.filter} onChange={filter => set({ filter })} poolSize={pool.length} />

      <div className="tk-qb-exam-options">
        <div className="tk-pane">
          <label className="tk-pane-label">NUMBER OF QUESTIONS</label>
          <input
            type="number" min={1} max={Math.max(1, pool.length)} className="tk-input-field"
            value={config.count}
            onChange={e => set({ count: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="tk-pane">
          <label className="tk-pane-label">TIME LIMIT (MINUTES, 0 = NONE)</label>
          <input
            type="number" min={0} className="tk-input-field"
            value={config.timeLimitMin}
            onChange={e => set({ timeLimitMin: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div className="tk-pane">
          <label className="tk-pane-label">ORDER</label>
          <select className="tk-input-field" value={config.order} onChange={e => set({ order: e.target.value })}>
            <option value="random">Random</option>
            <option value="in-order">As listed</option>
          </select>
        </div>
        <label className="tk-qb-check">
          <input type="checkbox" checked={config.shuffleOptions} onChange={e => set({ shuffleOptions: e.target.checked })} />
          Shuffle answer options
        </label>
      </div>

      <button
        className="tk-action-btn"
        disabled={pool.length === 0}
        onClick={() => onStart(pool, describeFilter(config.filter, bank))}
      >
        Start exam ({Math.min(config.count, pool.length)} question{Math.min(config.count, pool.length) === 1 ? "" : "s"})
      </button>
    </div>
  );
}

// ─── Running ─────────────────────────────────────────────────────────────────

function useNow(active) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function RunningExam({ bank, progress, session, setSession, actions, onFinish }) {
  const now = useNow(true);
  const { items, answers, index, deadline } = session;
  const item = items[index];
  const question = bank.questionsById.get(item.questionId);
  const answeredCount = items.filter(i => answers[i.questionId]).length;
  const isLast = index === items.length - 1;

  // Time's up — also fires right away when resuming an exam whose deadline
  // passed while you were away. The ref stops a double finish between ticks.
  const finishedRef = useRef(false);
  const expired = deadline != null && now >= deadline;
  useEffect(() => {
    if (expired && !finishedRef.current) { finishedRef.current = true; onFinish(); }
  }, [expired, onFinish]);

  const go = i => setSession(s => ({ ...s, index: Math.max(0, Math.min(i, s.items.length - 1)) }));

  function handleAnswer(a) {
    setSession(s => ({ ...s, answers: { ...s.answers, [item.questionId]: a } }));
    actions.recordAttempt(item.questionId, isCorrectAnswer(question, a));
  }

  const advance = (
    <button className="tk-action-btn" onClick={() => (isLast ? onFinish() : go(index + 1))}>
      {isLast ? "Finish" : answers[item.questionId] ? "Next →" : "Skip →"}
    </button>
  );

  return (
    <div className="tk-qb-exam">
      <div className="tk-qb-exam-top">
        <span>Question {index + 1} / {items.length}</span>
        <span className="tk-qb-note">{answeredCount} answered</span>
        {deadline != null && (
          <span className={`tk-qb-timer${deadline - now < 60000 ? " tk-qb-timer--low" : ""}`}>
            ⏱ {formatDuration(deadline - now)}
          </span>
        )}
        <button className="tk-action-btn" onClick={() => go(index - 1)} disabled={index === 0}>← Prev</button>
        <button className="tk-action-btn tk-danger" onClick={onFinish}>End exam</button>
      </div>
      <div className="tk-qb-progress">
        <div className="tk-qb-progress-fill" style={{ width: `${(answeredCount / items.length) * 100}%` }} />
      </div>

      <div className="tk-qb-question-card">
        {question ? (
          <>
            <QuestionMeta
              question={question}
              bank={bank}
              entry={getEntry(progress, question.id)}
              onToggleFavorite={actions.toggleFavorite}
            />
            <QuestionPrompt question={question} />
            <AnswerControls
              key={item.questionId}
              question={question}
              optionOrder={item.optionOrder}
              initialAnswer={answers[item.questionId] ?? null}
              onAnswer={handleAnswer}
            >
              {advance}
            </AnswerControls>
          </>
        ) : (
          <>
            <p className="tk-qb-tree-empty">This question was removed from the bank by a sync.</p>
            <div className="tk-qb-study-actions">{advance}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function ExamSummary({ bank, session, onRetake, onNew }) {
  const grade = gradeExam(session.items, session.answers, bank.questionsById);
  const mistakes = session.items
    .map(i => bank.questionsById.get(i.questionId))
    .filter(q => q && !isCorrectAnswer(q, session.answers[q.id]));

  return (
    <div className="tk-qb-exam">
      <div className="tk-qb-tiles">
        <div className="tk-qb-tile"><strong>{grade.percent}%</strong><span>score</span></div>
        <div className="tk-qb-tile"><strong>{grade.correct}/{grade.total}</strong><span>correct</span></div>
        <div className="tk-qb-tile"><strong>{grade.wrong}</strong><span>wrong</span></div>
        <div className="tk-qb-tile"><strong>{grade.skipped}</strong><span>skipped</span></div>
        <div className="tk-qb-tile"><strong>{formatDuration(session.finishedAt - session.startedAt)}</strong><span>time</span></div>
      </div>

      <div className="tk-qb-study-actions">
        {mistakes.length > 0 && (
          <button className="tk-action-btn" onClick={() => onRetake(mistakes)}>Retake mistakes ({mistakes.length})</button>
        )}
        <button className="tk-action-btn" onClick={onNew}>New exam</button>
      </div>

      <div className="tk-qb-question-list">
        {session.items.map((item, n) => {
          const q = bank.questionsById.get(item.questionId);
          if (!q) return null;
          const a = session.answers[q.id];
          const mark = !a ? "–" : isCorrectAnswer(q, a) ? "✓" : "✗";
          return (
            <details key={q.id} className="tk-qb-review-item">
              <summary>
                <span className={`tk-qb-mark tk-qb-mark--${!a ? "skip" : mark === "✓" ? "ok" : "bad"}`}>{mark}</span>
                {n + 1}. {q.questionText}
              </summary>
              <QuestionPrompt question={q} />
              {q.type === "mcq" && <OptionList question={q} optionOrder={item.optionOrder} picked={a?.picked ?? null} revealed />}
              <AnswerDetails question={q} />
            </details>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function ExamPanel({ bank, progress, actions, onExamFinished }) {
  const [storedConfig, setConfig] = usePersistentState("tool:question_bank:exam-config", CONFIG_DEFAULT);
  const [session, setSession] = usePersistentState("tool:question_bank:exam-session", null, { debounceMs: 0 });
  const config = {
    ...CONFIG_DEFAULT,
    ...storedConfig,
    filter: sanitizeFilter(storedConfig.filter, bank.catById, bank.tags),
  };

  function start(pool, label, overrides = {}) {
    const now = Date.now();
    setSession({
      status: "running",
      label,
      items: buildExam(pool, { ...config, ...overrides }),
      answers: {},
      index: 0,
      startedAt: now,
      deadline: config.timeLimitMin > 0 ? now + config.timeLimitMin * 60000 : null,
      finishedAt: null,
    });
  }

  // Reads the latest session through a ref so the timer effect in
  // RunningExam can hold a stable callback.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const finishRef = useRef(null);
  finishRef.current = () => {
    const s = sessionRef.current;
    if (!s || s.status !== "running") return;
    const finishedAt = Date.now();
    setSession({ ...s, status: "done", finishedAt });
    onExamFinished({
      id: s.startedAt,
      at: finishedAt,
      label: s.label,
      durationMs: finishedAt - s.startedAt,
      ...gradeExam(s.items, s.answers, bank.questionsById),
    });
  };
  const finish = useCallback(() => finishRef.current(), []);

  if (session?.status === "running") {
    return (
      <RunningExam
        bank={bank}
        progress={progress}
        session={session}
        setSession={setSession}
        actions={actions}
        onFinish={finish}
      />
    );
  }

  if (session?.status === "done") {
    return (
      <ExamSummary
        bank={bank}
        session={session}
        onRetake={mistakes => start(mistakes, `Retake: ${session.label}`, { count: mistakes.length, order: "random" })}
        onNew={() => setSession(null)}
      />
    );
  }

  return <ExamConfig bank={bank} progress={progress} config={config} setConfig={setConfig} onStart={start} />;
}
