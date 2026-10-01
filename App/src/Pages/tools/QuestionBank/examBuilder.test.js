// Plain Node script: node src/Pages/tools/QuestionBank/examBuilder.test.js
// Covers examBuilder.js plus the pure modules it builds on (progress.js, categories.js).
import { filterPool, buildExam, gradeExam, isCorrectAnswer, shuffle } from "./examBuilder.js";
import { withAttempt, withFlag, getEntry, EMPTY_ENTRY } from "./progress.js";
import { collectSubtreeIds, countBySubtree, categoryPath, buildCategoryTree } from "./categories.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

// Deterministic RNG so shuffles are reproducible.
function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

const categories = [
  { id: 1, name: "English", parentId: null },
  { id: 2, name: "Grammar", parentId: 1 },
  { id: 3, name: "Prepositions", parentId: 2 },
  { id: 4, name: "Math", parentId: null },
];
const mcq = (id, categoryId, extra = {}) => ({
  id, categoryId, type: "mcq", tags: [], correctOptionLabel: "a",
  options: [{ label: "a", text: "A" }, { label: "b", text: "B" }, { label: "c", text: "C" }], ...extra,
});
const questions = [
  mcq(1, 1),
  mcq(2, 3, { tags: ["DFA", "Exam"] }),
  { id: 3, categoryId: 4, type: "short", tags: ["DFA"], options: [] },
  mcq(4, 2),
];

// ─── categories ──────────────────────────────────────────────────────────────

check("subtree includes descendants", [...collectSubtreeIds(categories, 1)].sort(), [1, 2, 3]);
check("subtree of leaf", [...collectSubtreeIds(categories, 3)], [3]);
const counts = countBySubtree(categories, questions);
check("counts roll up to ancestors", [counts.get(1), counts.get(2), counts.get(3), counts.get(4)], [3, 2, 1, 1]);
const byId = new Map(categories.map(c => [c.id, c]));
check("category path", categoryPath(byId, 3), "English › Grammar › Prepositions");
check("tree roots sorted", buildCategoryTree(categories).map(n => n.name), ["English", "Math"]);
check("countBySubtree survives a parent cycle",
  countBySubtree([{ id: 1, parentId: 2 }, { id: 2, parentId: 1 }], [{ categoryId: 1 }]).get(2), 1);

// ─── progress ────────────────────────────────────────────────────────────────

let progress = {};
check("empty entry for unknown id", getEntry(progress, 99), EMPTY_ENTRY);
progress = withAttempt(progress, 2, false, 1000);
progress = withAttempt(progress, 2, true, 2000);
check("attempts accumulate",
  (({ shown, correct, wrong, lastResult, lastAt, read }) => ({ shown, correct, wrong, lastResult, lastAt, read }))(getEntry(progress, 2)),
  { shown: 2, correct: 1, wrong: 1, lastResult: "correct", lastAt: 2000, read: true });
progress = withAttempt(progress, 4, false, 3000);
progress = withFlag(progress, 1, "fav");
check("flag toggles on", getEntry(progress, 1).fav, true);
check("flag toggles off", getEntry(withFlag(progress, 1, "fav"), 1).fav, false);
check("flag explicit value", getEntry(withFlag(progress, 1, "fav", true), 1).fav, true);
check("original progress untouched", withFlag(progress, 3, "fav") !== progress && !progress[3], true);

// ─── filterPool ──────────────────────────────────────────────────────────────

const ids = pool => pool.map(q => q.id);
check("no filter → everything", ids(filterPool(questions, categories, progress)), [1, 2, 3, 4]);
check("category includes sub-categories", ids(filterPool(questions, categories, progress, { categoryIds: [2] })), [2, 4]);
check("multiple categories union", ids(filterPool(questions, categories, progress, { categoryIds: [3, 4] })), [2, 3]);
check("type filter", ids(filterPool(questions, categories, progress, { type: "short" })), [3]);
check("tags must all match", ids(filterPool(questions, categories, progress, { tags: ["DFA", "Exam"] })), [2]);
check("favorites", ids(filterPool(questions, categories, progress, { source: "favorites" })), [1]);
check("wrong = last attempt wrong (2 was fixed)", ids(filterPool(questions, categories, progress, { source: "wrong" })), [4]);
check("unseen", ids(filterPool(questions, categories, progress, { source: "unseen" })), [1, 3]);
check("filters combine", ids(filterPool(questions, categories, progress, { categoryIds: [1], source: "unseen" })), [1]);

// ─── buildExam / grading ─────────────────────────────────────────────────────

check("shuffle keeps all elements", shuffle([1, 2, 3, 4, 5], seeded(1)).sort(), [1, 2, 3, 4, 5]);
check("shuffle doesn't mutate input", (() => { const a = [1, 2, 3]; shuffle(a, seeded(2)); return a; })(), [1, 2, 3]);

let exam = buildExam(questions, { count: 2, order: "in-order" });
check("in-order exam takes the first N", exam.map(i => i.questionId), [1, 2]);
check("options not shuffled by default", exam.every(i => i.optionOrder === null), true);
check("count clamped to pool size", buildExam(questions, { count: 50 }, seeded(3)).length, 4);
check("count at least 1", buildExam(questions, { count: 0 }, seeded(3)).length, 1);

exam = buildExam(questions, { count: 4, shuffleOptions: true }, seeded(4));
const orderFor = id => exam.find(i => i.questionId === id).optionOrder;
check("shuffled options keep every label", [...orderFor(1)].sort(), ["a", "b", "c"]);
check("short answers never get an option order", orderFor(3), null);

check("mcq correct", isCorrectAnswer(questions[0], { picked: "a" }), true);
check("mcq wrong", isCorrectAnswer(questions[0], { picked: "b" }), false);
check("short self-graded", isCorrectAnswer(questions[2], { selfGrade: true }), true);
check("no answer is not correct", isCorrectAnswer(questions[0], undefined), false);

const qById = new Map(questions.map(q => [q.id, q]));
const items = [1, 2, 3, 4].map(questionId => ({ questionId }));
check("grade exam", gradeExam(items, { 1: { picked: "a" }, 2: { picked: "c" }, 3: { selfGrade: true } }, qById),
  { total: 4, correct: 2, wrong: 1, skipped: 1, percent: 50 });
check("question deleted since the exam counts as skipped",
  gradeExam([{ questionId: 99 }], { 99: { picked: "a" } }, qById).skipped, 1);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
