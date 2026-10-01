import { collectSubtreesIds } from "./categories.js";
import { getEntry, isFavorite, isUnseen, isWrong } from "./progress.js";

// Pure question-selection and grading logic shared by Study and Exam.

export const SOURCES = [
  { id: "all",       label: "All questions" },
  { id: "favorites", label: "Favorites" },
  { id: "wrong",     label: "Last answered wrong" },
  { id: "unseen",    label: "Not seen yet" },
];

export const TYPES = [
  { id: "any",   label: "Any type" },
  { id: "mcq",   label: "Multiple choice" },
  { id: "short", label: "Short answer" },
];

const SOURCE_TEST = { favorites: isFavorite, wrong: isWrong, unseen: isUnseen };

export const DEFAULT_FILTER = Object.freeze({ categoryIds: [], source: "all", type: "any", tags: [] });

// A saved filter may reference categories/tags a later sync removed — drop
// those instead of silently matching nothing. Missing fields get defaults.
export function sanitizeFilter(filter, catById, tags) {
  const f = { ...DEFAULT_FILTER, ...filter };
  return {
    ...f,
    categoryIds: f.categoryIds.filter(id => catById.has(id)),
    tags: f.tags.filter(t => tags.includes(t)),
  };
}

// categoryIds include their sub-categories; tags must all be present.
export function filterPool(questions, categories, progress, filter = DEFAULT_FILTER) {
  const { categoryIds = [], source = "all", type = "any", tags = [] } = filter;
  const allowed = collectSubtreesIds(categories, categoryIds);
  const test = SOURCE_TEST[source];
  return questions.filter(q =>
    (!allowed || allowed.has(q.categoryId)) &&
    (type === "any" || q.type === type) &&
    tags.every(t => q.tags.includes(t)) &&
    (!test || test(getEntry(progress, q.id)))
  );
}

export function shuffle(array, rng = Math.random) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Returns exam items: [{ questionId, optionOrder }]. optionOrder is the
// display order of option labels (null = as authored). Shuffling options is
// opt-in because answers like "All of the above" depend on position.
export function buildExam(pool, { count, order = "random", shuffleOptions = false }, rng = Math.random) {
  const picked = (order === "random" ? shuffle(pool, rng) : pool)
    .slice(0, Math.max(1, Math.min(count, pool.length)));
  return picked.map(q => ({
    questionId: q.id,
    optionOrder: shuffleOptions && q.type === "mcq" ? shuffle(q.options.map(o => o.label), rng) : null,
  }));
}

export function isCorrectAnswer(question, answer) {
  if (!answer) return false;
  return question.type === "mcq"
    ? answer.picked != null && answer.picked === question.correctOptionLabel
    : answer.selfGrade === true;
}

// answers: { [questionId]: { picked?, selfGrade? } }
export function gradeExam(items, answers, questionsById) {
  let correct = 0, wrong = 0, skipped = 0;
  for (const { questionId } of items) {
    const q = questionsById.get(questionId);
    const a = answers[questionId];
    if (!q || !a) { skipped++; continue; }
    if (isCorrectAnswer(q, a)) correct++; else wrong++;
  }
  const total = items.length;
  return { total, correct, wrong, skipped, percent: total ? Math.round((correct / total) * 100) : 0 };
}
