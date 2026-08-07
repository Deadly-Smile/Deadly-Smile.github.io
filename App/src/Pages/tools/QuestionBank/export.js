// Shared bank <-> JSON (de)serialization, used by both the "download backup"
// action (Phase 4) and the P2P sync payload (Phase 5) — one format, one path.

const FORMAT_VERSION = 2;

// Tags and favorite/read status travel with the bank like question content —
// they're curated data, not ambient telemetry. questionStats (auto-tracked
// wrong/correct counts) deliberately stays out of this and per-device only.
export function serializeBank(categories, questions, tags = []) {
  return {
    format: "question-bank",
    version: FORMAT_VERSION,
    exportedAt: Date.now(),
    categories: categories.map(({ id, name, parentId }) => ({ id, name, parentId })),
    tags: tags.map(({ id, name }) => ({ id, name })),
    questions: questions.map(({
      id, categoryId, questionText, options, correctOptionLabel, language, source,
      ocrConfidence, rawOcrText, createdAt, tagIds, explanation, isFavorite, isRead,
    }) => ({
      id, categoryId, questionText, options, correctOptionLabel, language, source,
      ocrConfidence, rawOcrText, createdAt,
      tagIds: tagIds ?? [], explanation: explanation ?? "", isFavorite: !!isFavorite, isRead: !!isRead,
    })),
  };
}

export function downloadBankAsJson(categories, questions, tags = [], filename = "question-bank-backup.json") {
  const payload = serializeBank(categories, questions, tags);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Validates and returns a parsed bank payload, or throws a human-readable error.
export function parseBankJson(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error("Not valid JSON.");
  }
  if (data?.format !== "question-bank" || !Array.isArray(data.categories) || !Array.isArray(data.questions)) {
    throw new Error("This file doesn't look like a question bank export.");
  }
  return data;
}
