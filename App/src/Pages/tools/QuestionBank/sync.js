import { CATEGORY_COLUMNS, QUESTION_COLUMNS, fetchChanged, fetchIds } from "./remote";
import { loadCache, applySync } from "./db";
import { mapCategory, mapQuestion, maxCursor, planSync } from "./syncLogic";

// One table: incremental when we have a cursor (changed rows + the live id
// list to detect deletions), full download otherwise.
async function syncTable(table, columns, mapRow, cachedRows, cursor) {
  const [changedRows, liveIds] = await Promise.all([
    fetchChanged(table, columns, cursor),
    cursor ? fetchIds(table) : null,
  ]);
  const changed = changedRows.map(mapRow);
  const plan = planSync(cachedRows, changed, liveIds ?? new Set(changed.map(r => r.id)));
  return { plan, cursor: maxCursor(changed, cursor) };
}

// Returns { categories: {added, updated, removed}, questions: {...} }.
export async function syncBank() {
  const cache = await loadCache();
  const [cats, qs] = await Promise.all([
    syncTable("categories", CATEGORY_COLUMNS, mapCategory, cache.categories, cache.meta.cursors.categories),
    syncTable("questions", QUESTION_COLUMNS, mapQuestion, cache.questions, cache.meta.cursors.questions),
  ]);
  await applySync(
    { categories: cats.plan, questions: qs.plan },
    { cursors: { categories: cats.cursor, questions: qs.cursor }, lastSyncedAt: Date.now() }
  );
  const summary = ({ added, updated, removed }) => ({ added, updated, removed });
  return { categories: summary(cats.plan), questions: summary(qs.plan) };
}
