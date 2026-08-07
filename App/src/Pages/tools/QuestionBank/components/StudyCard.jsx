import { useState } from "react";
import { patchQuestion } from "../db";
import { recordAttempt } from "../stats";

// Interactive reveal: pick an option, then Show Answer — auto-graded against
// correctOptionLabel and fed into stats.js so "most wrong answered" reflects
// Study activity, not just formal Exam attempts.
export default function StudyCard({ question, onChanged }) {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  function pick(label) {
    if (revealed) return;
    setSelectedLabel(label);
  }

  async function reveal() {
    if (revealed) return;
    setRevealed(true);
    if (selectedLabel) {
      await recordAttempt(question.id, selectedLabel === question.correctOptionLabel);
    }
    if (!question.isRead) {
      await patchQuestion(question.id, { isRead: true });
      onChanged?.();
    }
  }

  function tryAgain() {
    setSelectedLabel(null);
    setRevealed(false);
    setShowExplanation(false);
  }

  async function toggleFlag(flag) {
    await patchQuestion(question.id, { [flag]: !question[flag] });
    onChanged?.();
  }

  return (
    <div className="tk-qb-question-card">
      <div className="tk-qb-question-meta">
        <button
          type="button"
          title={question.isFavorite ? "Unfavorite" : "Favorite"}
          className="tk-qb-tree-danger"
          onClick={() => toggleFlag("isFavorite")}
        >
          {question.isFavorite ? "★" : "☆"}
        </button>
        <span className={`tk-qb-badge${question.isRead ? " tk-qb-badge--ok" : ""}`}>{question.isRead ? "read" : "unread"}</span>
      </div>

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

      <div className="tk-qb-study-actions">
        {!revealed ? (
          <button className="tk-action-btn" onClick={reveal}>Show answer</button>
        ) : (
          <button className="tk-action-btn" onClick={tryAgain}>Try again</button>
        )}
        {revealed && question.explanation && (
          <button className="tk-action-btn" onClick={() => setShowExplanation(v => !v)}>
            {showExplanation ? "Hide explanation" : "Explanation"}
          </button>
        )}
      </div>

      {showExplanation && <p className="tk-qb-review-reason">ব্যাখ্যা: {question.explanation}</p>}
    </div>
  );
}
