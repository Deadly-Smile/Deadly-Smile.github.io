// Plain Node script: node src/Pages/tools/QuestionBank/syncLogic.test.js
import { mapCategory, mapQuestion, maxCursor, planSync } from "./syncLogic.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

// ─── mapping ─────────────────────────────────────────────────────────────────

check("category mapping", mapCategory({ id: 2, name: "Grammar", parent_id: 1, updated_at: "t1", created_by: null }),
  { id: 2, name: "Grammar", parentId: 1, updatedAt: "t1" });

const q = mapQuestion({
  id: 7, category_id: 3, type: "mcq", question_text: "Q?",
  options: [{ label: "a", text: "x" }], correct_option_label: "a",
  answer_text: null, explanation: null, extra_sections: null, tags: null, images: null,
  updated_at: "t2",
});
check("question mapping: nulls become safe defaults",
  [q.answerText, q.explanation, q.extraSections, q.tags, q.images, q.language],
  ["", "", [], [], [], "en"]);
check("question mapping: fields renamed", [q.categoryId, q.questionText, q.correctOptionLabel, q.updatedAt], [3, "Q?", "a", "t2"]);
check("unknown type treated as short", mapQuestion({ id: 1, type: "weird" }).type, "short");

// ─── cursor ──────────────────────────────────────────────────────────────────

check("cursor: max of rows", maxCursor([
  { updatedAt: "2026-09-28T19:56:45.12702+00:00" },
  { updatedAt: "2026-09-28T19:56:45.127021+00:00" },
  { updatedAt: "2026-09-28T19:56:45+00:00" },
]), "2026-09-28T19:56:45.127021+00:00");
check("cursor: keeps current when no rows", maxCursor([], "2026-01-01T00:00:00+00:00"), "2026-01-01T00:00:00+00:00");
check("cursor: current wins if newer", maxCursor([{ updatedAt: "2026-01-01T00:00:00+00:00" }], "2026-02-01T00:00:00+00:00"), "2026-02-01T00:00:00+00:00");
check("cursor: null with nothing", maxCursor([]), null);

// ─── planSync ────────────────────────────────────────────────────────────────

const cached = [
  { id: 1, updatedAt: "a" },
  { id: 2, updatedAt: "a" },
  { id: 3, updatedAt: "a" },
];

let plan = planSync(cached, [{ id: 2, updatedAt: "b" }, { id: 4, updatedAt: "b" }], new Set([1, 2, 4]));
check("incremental: counts", [plan.added, plan.updated, plan.removed], [1, 1, 1]);
check("incremental: upserts changed + new", plan.upserts.map(r => r.id), [2, 4]);
check("incremental: deletes missing from live ids", plan.deletes, [3]);

plan = planSync(cached, [{ id: 3, updatedAt: "a" }], new Set([1, 2, 3]));
check("boundary row with same updatedAt is not an update", [plan.upserts.length, plan.updated], [0, 0]);

const all = [{ id: 1, updatedAt: "a" }, { id: 5, updatedAt: "a" }];
plan = planSync(cached, all, new Set(all.map(r => r.id)));
check("full sync: rows absent from the download are removed", plan.deletes, [2, 3]);
check("full sync: counts", [plan.added, plan.updated, plan.removed], [1, 0, 2]);

plan = planSync([], [{ id: 1, updatedAt: "a" }], new Set([1]));
check("first sync into empty cache", [plan.added, plan.removed], [1, 0]);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
