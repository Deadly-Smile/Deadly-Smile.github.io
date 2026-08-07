import { useState } from "react";
import CategoryPicker from "./CategoryPicker";
import TagPicker from "./TagPicker";

const LABEL_SETS = { bn: ["ক", "খ", "গ", "ঘ"], en: ["a", "b", "c", "d"] };
const LAST_CATEGORY_KEY = "qb-last-category-id";

export function loadLastCategoryId() {
  try {
    const raw = localStorage.getItem(LAST_CATEGORY_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function saveLastCategoryId(id) {
  try { localStorage.setItem(LAST_CATEGORY_KEY, String(id)); } catch {}
}

// Builds the blank/pre-filled form state from either nothing (manual entry)
// or a parsed OCR question (review flow) — same shape either way.
function buildInitialState(initialValues, defaultCategoryId) {
  const language = initialValues?.language ?? "bn";
  const labels = LABEL_SETS[language];
  const options = labels.map((label, i) => ({
    label,
    text: initialValues?.options?.[i]?.text ?? "",
  }));
  const correctIndex = Math.max(0, labels.indexOf(initialValues?.correctOptionLabel ?? labels[0]));
  return {
    categoryId: initialValues?.categoryId ?? defaultCategoryId ?? null,
    language,
    questionText: initialValues?.questionText ?? "",
    options,
    correctIndex,
    explanation: initialValues?.explanation ?? "",
    tagIds: initialValues?.tagIds ?? [],
  };
}

export default function QuestionForm({
  categories,
  allTags = [],
  onTagsChanged,
  initialValues = null,
  onSave,
  onCancel,
  submitLabel = "Save",
  extraFields = {}, // passthrough fields like source/ocrConfidence/rawOcrText for the OCR review flow
  checkDuplicate, // optional: candidate => existing matching question | null
}) {
  const [state, setState] = useState(() => buildInitialState(initialValues, loadLastCategoryId()));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  function setLanguage(language) {
    setState(prev => ({
      ...prev,
      language,
      options: LABEL_SETS[language].map((label, i) => ({ label, text: prev.options[i]?.text ?? "" })),
      correctIndex: 0,
    }));
  }

  function setOptionText(index, text) {
    setState(prev => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, text } : o)),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!state.categoryId) return setError("Pick a category.");
    if (!state.questionText.trim()) return setError("Question text is required.");
    if (state.options.some(o => !o.text.trim())) return setError("All 4 options must have text.");

    const candidate = {
      categoryId: state.categoryId,
      questionText: state.questionText.trim(),
      options: state.options.map(o => ({ ...o, text: o.text.trim() })),
      correctOptionLabel: state.options[state.correctIndex].label,
      language: state.language,
      explanation: state.explanation.trim(),
      tagIds: state.tagIds,
    };

    if (checkDuplicate && !duplicateConfirmed && checkDuplicate(candidate)) {
      setDuplicateConfirmed(true);
      setError("A very similar question already exists in this category. Click Save again to add it anyway.");
      return;
    }

    setSaving(true);
    try {
      saveLastCategoryId(state.categoryId);
      await onSave({ ...candidate, source: "manual", ...extraFields });
      setDuplicateConfirmed(false);
      if (!initialValues) {
        setState(buildInitialState(null, state.categoryId));
      }
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="tk-qb-form" onSubmit={handleSubmit}>
      <div className="tk-pane">
        <label className="tk-pane-label">CATEGORY</label>
        <CategoryPicker categories={categories} value={state.categoryId} onChange={id => setState(p => ({ ...p, categoryId: id }))} />
      </div>

      <div className="tk-pane">
        <label className="tk-pane-label">LANGUAGE</label>
        <div className="tk-qb-lang-toggle">
          <button type="button" className={state.language === "bn" ? "tk-active" : ""} onClick={() => setLanguage("bn")}>বাংলা</button>
          <button type="button" className={state.language === "en" ? "tk-active" : ""} onClick={() => setLanguage("en")}>English</button>
        </div>
      </div>

      <div className="tk-pane">
        <label className="tk-pane-label">QUESTION</label>
        <textarea
          className="tk-textarea-field"
          rows={3}
          value={state.questionText}
          onChange={e => setState(p => ({ ...p, questionText: e.target.value }))}
          placeholder="Question text…"
        />
      </div>

      <div className="tk-pane">
        <label className="tk-pane-label">OPTIONS — select the correct one</label>
        {state.options.map((opt, i) => (
          <div key={opt.label} className="tk-qb-option-row">
            <input
              type="radio"
              name="correct-option"
              checked={state.correctIndex === i}
              onChange={() => setState(p => ({ ...p, correctIndex: i }))}
            />
            <span className="tk-qb-option-label">({opt.label})</span>
            <input
              className="tk-input-field"
              value={opt.text}
              onChange={e => setOptionText(i, e.target.value)}
              placeholder={`Option ${opt.label}`}
            />
          </div>
        ))}
      </div>

      <div className="tk-pane">
        <label className="tk-pane-label">TAGS</label>
        <TagPicker
          allTags={allTags}
          selectedIds={state.tagIds}
          onChange={tagIds => setState(p => ({ ...p, tagIds }))}
          onTagsChanged={onTagsChanged}
        />
      </div>

      <div className="tk-pane">
        <label className="tk-pane-label">EXPLANATION / ব্যাখ্যা (optional)</label>
        <textarea
          className="tk-textarea-field"
          rows={2}
          value={state.explanation}
          onChange={e => setState(p => ({ ...p, explanation: e.target.value }))}
          placeholder="Why this is the correct answer…"
        />
      </div>

      {error && <div className="tk-error">{error}</div>}

      <div className="tk-qb-form-actions">
        {onCancel && <button type="button" className="tk-action-btn" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="tk-action-btn" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
