import { ConfirmModal } from "../../../../Utils/Modal";
import { useState } from "react";
import { patchQuestion } from "../db";

function categoryName(categories, id) {
  return categories.find(c => c.id === id)?.name ?? "—";
}

function tagNames(tags, tagIds) {
  return (tagIds ?? []).map(id => tags.find(t => t.id === id)?.name).filter(Boolean);
}

export default function QuestionList({ questions, categories, tags = [], onDelete, onChanged }) {
  const [pendingDelete, setPendingDelete] = useState(null);

  if (questions.length === 0) {
    return <p className="tk-qb-tree-empty">No questions here yet.</p>;
  }

  async function toggleFlag(q, flag) {
    await patchQuestion(q.id, { [flag]: !q[flag] });
    onChanged?.();
  }

  return (
    <div className="tk-qb-question-list">
      {questions.map(q => (
        <div key={q.id} className="tk-qb-question-card">
          <div className="tk-qb-question-meta">
            <span className="tk-qb-badge">{categoryName(categories, q.categoryId)}</span>
            <span className="tk-qb-badge">{q.language === "bn" ? "বাংলা" : "English"}</span>
            <span className={`tk-qb-badge${q.source === "ocr" ? " tk-qb-badge--ocr" : ""}`}>{q.source}</span>
            {q.source === "ocr" && typeof q.ocrConfidence === "number" && (
              <span className={`tk-qb-badge${q.ocrConfidence < 70 ? " tk-qb-badge--warn" : ""}`}>
                conf {Math.round(q.ocrConfidence)}%
              </span>
            )}
            {tagNames(tags, q.tagIds).map(name => <span key={name} className="tk-qb-badge">#{name}</span>)}
            <button
              title={q.isFavorite ? "Unfavorite" : "Favorite"}
              className="tk-qb-tree-danger"
              onClick={() => toggleFlag(q, "isFavorite")}
            >
              {q.isFavorite ? "★" : "☆"}
            </button>
            <button
              title={q.isRead ? "Mark unread" : "Mark read"}
              className="tk-qb-tree-danger"
              onClick={() => toggleFlag(q, "isRead")}
            >
              {q.isRead ? "✓ read" : "unread"}
            </button>
            <button className="tk-qb-tree-danger" style={{ marginLeft: "auto" }} onClick={() => setPendingDelete(q)}>✕</button>
          </div>
          <p className="tk-qb-question-text">{q.questionText}</p>
          <div className="tk-qb-option-grid">
            {q.options.map(o => (
              <span key={o.label} className={`tk-qb-option${o.label === q.correctOptionLabel ? " tk-qb-option--correct" : ""}`}>
                ({o.label}) {o.text}
              </span>
            ))}
          </div>
          {q.explanation && <p className="tk-qb-review-reason">ব্যাখ্যা: {q.explanation}</p>}
        </div>
      ))}

      <ConfirmModal
        isOpen={!!pendingDelete}
        title="Delete question?"
        message="This can't be undone."
        onClose={() => setPendingDelete(null)}
        onConfirm={() => onDelete(pendingDelete.id)}
        danger
      />
    </div>
  );
}
