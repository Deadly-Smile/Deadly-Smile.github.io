// Duplicate detection shared by save-time warnings (same device, compares by
// categoryId) and P2P sync merge (Phase 5, compares by category *path* since
// autoincrement ids differ across devices) — callers supply how to key a
// category so this stays a pure text-similarity check either way.

function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

export function questionFingerprint(categoryKey, questionText, options) {
  const optionsPart = options.map(o => normalize(o.text)).sort().join("|");
  return `${categoryKey}::${normalize(questionText)}::${optionsPart}`;
}

export function findDuplicate(existingQuestions, candidate, categoryKeyOf) {
  const targetFp = questionFingerprint(categoryKeyOf(candidate), candidate.questionText, candidate.options);
  return existingQuestions.find(
    q => questionFingerprint(categoryKeyOf(q), q.questionText, q.options) === targetFp
  ) ?? null;
}

export const byCategoryId = (q) => String(q.categoryId);
