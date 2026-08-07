import QuestionForm from "./QuestionForm";
import { findDuplicate, byCategoryId } from "../dedupe";

export default function ReviewCard({ parsed, categories, questions, allTags, onTagsChanged, onSave, onDiscard }) {
  const confidence = parsed.ocrConfidence;
  const lowConfidence = typeof confidence === "number" && confidence < 70;

  return (
    <div className="tk-qb-review-card">
      <div className="tk-qb-question-meta">
        <span className={`tk-qb-badge${parsed.needsReview ? " tk-qb-badge--warn" : ""}`}>
          {parsed.needsReview ? "⚠ Needs review" : "✓ Parsed"}
        </span>
        {typeof confidence === "number" && (
          <span className={`tk-qb-badge${lowConfidence ? " tk-qb-badge--warn" : ""}`}>
            OCR confidence {Math.round(confidence)}%{lowConfidence ? " — please check" : ""}
          </span>
        )}
      </div>

      {parsed.needsReview && (
        <>
          <p className="tk-qb-review-reason">{parsed.reason} Fill in the fields below by hand using the raw OCR text as reference.</p>
          <pre className="tk-output-pre tk-qb-raw-text">{parsed.rawOcrText}</pre>
        </>
      )}

      <QuestionForm
        categories={categories}
        allTags={allTags}
        onTagsChanged={onTagsChanged}
        initialValues={parsed.needsReview ? null : parsed}
        onSave={onSave}
        onCancel={onDiscard}
        submitLabel="Save question"
        extraFields={{ source: "ocr", ocrConfidence: confidence, rawOcrText: parsed.rawOcrText }}
        checkDuplicate={questions ? (candidate) => findDuplicate(questions, candidate, byCategoryId) : undefined}
      />
    </div>
  );
}
