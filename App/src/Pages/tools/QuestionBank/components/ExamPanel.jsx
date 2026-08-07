import { useState } from "react";
import QuestionFilterPicker, { filterQuestions } from "./QuestionFilterPicker";
import { recordAttempt } from "../stats";

function shuffled(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Owns the full pick -> submit -> next flow for one question. Keyed by
// question.id in the parent so switching questions remounts (and resets)
// this rather than needing reveal state lifted up.
function ExamQuestion({ question, isLast, onAnswered, onNext }) {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [revealed, setRevealed] = useState(false);

  function pick(label) {
    if (!revealed) setSelectedLabel(label);
  }

  async function submit() {
    if (revealed) return;
    setRevealed(true);
    const correct = selectedLabel != null && selectedLabel === question.correctOptionLabel;
    if (selectedLabel != null) await recordAttempt(question.id, correct);
    onAnswered(correct);
  }

  return (
    <div className="tk-qb-question-card">
      <p className="tk-qb-question-text">{question.questionText}</p>
      <div className="tk-qb-study-options">
        {question.options.map(o => {
          const isPicked = selectedLabel === o.label;
          const isCorrect = o.label === question.correctOptionLabel;
          let cls = "tk-qb-study-option";
          if (revealed && isCorrect) cls += " tk-qb-study-option--correct";
          else if (revealed && isPicked && !isCorrect) cls += " tk-qb-study-option--wrong";
          else if (!revealed && isPicked) cls += " tk-qb-study-option--picked";
          return (
            <button key={o.label} type="button" className={cls} onClick={() => pick(o.label)} disabled={revealed}>
              ({o.label}) {o.text}
            </button>
          );
        })}
      </div>
      {revealed && question.explanation && <p className="tk-qb-review-reason">ব্যাখ্যা: {question.explanation}</p>}
      <div className="tk-qb-study-actions">
        {!revealed ? (
          <button className="tk-action-btn" onClick={submit}>Submit answer</button>
        ) : (
          <button className="tk-action-btn" onClick={onNext}>{isLast ? "Finish" : "Next question"}</button>
        )}
      </div>
    </div>
  );
}

export default function ExamPanel({ categories, questions, tags }) {
  const [stage, setStage] = useState("config"); // config | running | summary
  const [categoryId, setCategoryId] = useState(null);
  const [tagIds, setTagIds] = useState([]);
  const [count, setCount] = useState(10);
  const [examQuestions, setExamQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState("");

  const pool = filterQuestions(questions, categories, { categoryId, tagIds });

  function start() {
    if (pool.length === 0) {
      setError("No questions match this filter.");
      return;
    }
    setError("");
    const n = Math.max(1, Math.min(count, pool.length));
    setExamQuestions(shuffled(pool).slice(0, n));
    setIndex(0);
    setCorrectCount(0);
    setStage("running");
  }

  function handleAnswered(correct) {
    if (correct) setCorrectCount(c => c + 1);
  }

  function handleNext() {
    if (index + 1 < examQuestions.length) setIndex(i => i + 1);
    else setStage("summary");
  }

  function restart() {
    setStage("config");
    setExamQuestions([]);
    setIndex(0);
    setCorrectCount(0);
  }

  if (stage === "config") {
    return (
      <div className="tk-qb-exam">
        <QuestionFilterPicker
          categories={categories}
          tags={tags}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          tagIds={tagIds}
          onTagIdsChange={setTagIds}
        />
        <div className="tk-pane">
          <label className="tk-pane-label">NUMBER OF QUESTIONS ({pool.length} available)</label>
          <input
            type="number"
            min={1}
            max={pool.length || 1}
            className="tk-input-field"
            value={count}
            onChange={e => setCount(Number(e.target.value) || 1)}
          />
        </div>
        {error && <div className="tk-error">{error}</div>}
        <button className="tk-action-btn" onClick={start} disabled={pool.length === 0}>Start exam</button>
      </div>
    );
  }

  if (stage === "running") {
    const current = examQuestions[index];
    return (
      <div className="tk-qb-exam">
        <p className="tk-qb-review-reason">Question {index + 1} of {examQuestions.length}</p>
        <ExamQuestion
          key={current.id}
          question={current}
          isLast={index === examQuestions.length - 1}
          onAnswered={handleAnswered}
          onNext={handleNext}
        />
      </div>
    );
  }

  return (
    <div className="tk-qb-exam">
      <p className="tk-qb-question-text">Score: {correctCount} / {examQuestions.length}</p>
      <button className="tk-action-btn" onClick={restart}>New exam</button>
    </div>
  );
}
