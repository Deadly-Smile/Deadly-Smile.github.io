import { imageUrl } from "../remote";
import { categoryPath } from "../categories";

// Rendering pieces shared by Browse, Study and Exam. Images carry an
// `attached_to` target ("question", "answer", "explanation", "solution",
// "section:<index>") and are shown next to the part they belong to; anything
// with an unknown target falls through to the end of the answer details.

const KNOWN_TARGET = /^(question|answer|explanation|solution|section:\d+)$/;

function imagesFor(question, target) {
  return question.images.filter(img =>
    target === "other" ? !KNOWN_TARGET.test(img.attached_to ?? "") : img.attached_to === target
  );
}

function Images({ images }) {
  if (images.length === 0) return null;
  return (
    <div className="tk-qb-images">
      {images.map(img => (
        <a key={img.path} href={imageUrl(img.path)} target="_blank" rel="noreferrer">
          <img src={imageUrl(img.path)} alt={img.alt || ""} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

export function QuestionMeta({ question, bank, entry, onToggleFavorite, children }) {
  return (
    <div className="tk-qb-question-meta">
      <button
        type="button"
        className="tk-qb-fav"
        title={entry.fav ? "Remove from favorites" : "Add to favorites"}
        onClick={() => onToggleFavorite(question.id)}
      >
        {entry.fav ? "★" : "☆"}
      </button>
      <span className="tk-qb-badge">{categoryPath(bank.catById, question.categoryId) || "Uncategorized"}</span>
      <span className="tk-qb-badge">{question.type === "mcq" ? "MCQ" : "Short"}</span>
      <span className="tk-qb-badge">{question.language === "bn" ? "বাংলা" : "English"}</span>
      {question.tags.map(t => <span key={t} className="tk-qb-badge tk-qb-badge--tag">#{t}</span>)}
      {entry.shown > 0 && (
        <span className={`tk-qb-badge ${entry.lastResult === "wrong" ? "tk-qb-badge--warn" : "tk-qb-badge--ok"}`}>
          {entry.correct}/{entry.shown} correct
        </span>
      )}
      {children}
    </div>
  );
}

export function QuestionPrompt({ question }) {
  return (
    <>
      <p className="tk-qb-question-text tk-qb-rich">{question.questionText}</p>
      <Images images={imagesFor(question, "question")} />
    </>
  );
}

// Interactive when onPick is given. optionOrder (exam option shuffle) changes
// the display order, so display letters are positional rather than the
// authored labels — grading always uses the authored label.
export function OptionList({ question, optionOrder = null, picked = null, revealed = false, onPick }) {
  const byLabel = new Map(question.options.map(o => [o.label, o]));
  const labels = optionOrder ?? question.options.map(o => o.label);

  return (
    <div className="tk-qb-study-options">
      {labels.map((label, i) => {
        const option = byLabel.get(label);
        if (!option) return null;
        const isPicked = picked === label;
        const isCorrect = label === question.correctOptionLabel;
        let cls = "tk-qb-study-option";
        if (revealed && isCorrect) cls += " tk-qb-study-option--correct";
        else if (revealed && isPicked) cls += " tk-qb-study-option--wrong";
        else if (isPicked) cls += " tk-qb-study-option--picked";
        return (
          <button
            key={label}
            type="button"
            className={cls}
            disabled={revealed || !onPick}
            onClick={() => onPick?.(label)}
          >
            ({optionOrder ? String.fromCharCode(97 + i) : label}) {option.text}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, body, images }) {
  if (!body && images.length === 0) return null;
  return (
    <div className="tk-qb-section">
      <span className="tk-pane-label">{title.toUpperCase()}</span>
      {body && <p className="tk-qb-rich">{body}</p>}
      <Images images={images} />
    </div>
  );
}

export function AnswerDetails({ question }) {
  const correct = question.options.find(o => o.label === question.correctOptionLabel);
  const answer = question.type === "mcq" ? correct?.text ?? "" : question.answerText;

  return (
    <div className="tk-qb-answer">
      <Section title="Answer" body={answer} images={imagesFor(question, "answer")} />
      <Section title="Explanation" body={question.explanation} images={imagesFor(question, "explanation")} />
      <Section title="Solution" body={question.solution} images={imagesFor(question, "solution")} />
      {question.extraSections.map((s, i) => (
        <Section key={i} title={s.title || "Note"} body={s.body} images={imagesFor(question, `section:${i}`)} />
      ))}
      <Images images={imagesFor(question, "other")} />
      {question.sourceTitle && (
        <p className="tk-qb-note">
          Source:{" "}
          {question.sourceUrl
            ? <a href={question.sourceUrl} target="_blank" rel="noreferrer">{question.sourceTitle}</a>
            : question.sourceTitle}
        </p>
      )}
    </div>
  );
}
