import { getDB } from "./db";

// questionStats is deliberately excluded from export/sync (see export.js) —
// it's auto-tracked activity, not curated content, and stays per-device.

export async function recordAttempt(questionId, wasCorrect) {
  const db = await getDB();
  const existing = await db.get("questionStats", questionId);
  const stat = existing ?? { questionId, timesShown: 0, timesCorrect: 0, timesWrong: 0, lastResult: null, lastAttemptedAt: null };
  stat.timesShown += 1;
  if (wasCorrect) stat.timesCorrect += 1;
  else stat.timesWrong += 1;
  stat.lastResult = wasCorrect ? "correct" : "wrong";
  stat.lastAttemptedAt = Date.now();
  await db.put("questionStats", stat);
  return stat;
}

export async function getAllStats() {
  const db = await getDB();
  return db.getAll("questionStats");
}

// Ranked by wrong-rate (not raw wrong count) so a question missed 3/3 times
// ranks above one missed 3/10 times, with raw wrong count as a tiebreaker.
export async function getMostWrong(questions, limit = 20) {
  const stats = await getAllStats();
  const byId = new Map(stats.map(s => [s.questionId, s]));
  return questions
    .map(question => ({ question, stat: byId.get(question.id) }))
    .filter(({ stat }) => stat && stat.timesWrong > 0)
    .sort((a, b) =>
      (b.stat.timesWrong / b.stat.timesShown) - (a.stat.timesWrong / a.stat.timesShown) ||
      b.stat.timesWrong - a.stat.timesWrong
    )
    .slice(0, limit);
}

// "Coverage" here means study progress: how much of each category's question
// pool has been engaged with (attempted in Study/Exam, or marked read) — not
// how many questions exist per category.
export async function getCategoryCoverage(categories, questions) {
  const stats = await getAllStats();
  const attemptedIds = new Set(stats.map(s => s.questionId));
  return categories
    .map(category => {
      const inCategory = questions.filter(q => q.categoryId === category.id);
      const covered = inCategory.filter(q => attemptedIds.has(q.id) || q.isRead).length;
      return { category, total: inCategory.length, covered };
    })
    .filter(row => row.total > 0);
}
