// Pure pieces of the Supabase → IndexedDB sync: row mapping and change
// planning. Network (remote.js) and storage (db.js) live elsewhere so this
// stays testable in plain Node.

export function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? null,
    updatedAt: row.updated_at,
  };
}

export function mapQuestion(row) {
  return {
    id: row.id,
    categoryId: row.category_id ?? null,
    type: row.type === "mcq" ? "mcq" : "short",
    questionText: row.question_text ?? "",
    options: Array.isArray(row.options) ? row.options : [],
    correctOptionLabel: row.correct_option_label ?? null,
    answerText: row.answer_text ?? "",
    explanation: row.explanation ?? "",
    solution: row.solution ?? "",
    extraSections: Array.isArray(row.extra_sections) ? row.extra_sections : [],
    language: row.language ?? "en",
    tags: Array.isArray(row.tags) ? row.tags : [],
    images: Array.isArray(row.images) ? row.images : [],
    sourceTitle: row.source_title ?? "",
    sourceUrl: row.source_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Latest updated_at seen, used as the next sync's lower bound. Postgres
// timestamptz strings from PostgREST share one format and UTC offset, so
// string comparison orders them correctly (including fractional seconds).
export function maxCursor(rows, current = null) {
  let max = current;
  for (const r of rows) if (r.updatedAt && (max == null || r.updatedAt > max)) max = r.updatedAt;
  return max;
}

// cached:  existing rows (need id + updatedAt)
// changed: rows returned by the "updated_at >= cursor" query (or everything, on a full sync)
// liveIds: every id currently in the remote table — anything cached but not
//          live was deleted remotely. updated_at alone can't reveal deletions.
// The ">=" bound re-returns boundary rows; identical updatedAt means unchanged.
export function planSync(cached, changed, liveIds) {
  const cachedById = new Map(cached.map(r => [r.id, r]));
  const upserts = [];
  let added = 0, updated = 0;
  for (const row of changed) {
    const prev = cachedById.get(row.id);
    if (!prev) { added++; upserts.push(row); }
    else if (prev.updatedAt !== row.updatedAt) { updated++; upserts.push(row); }
  }
  const deletes = cached.filter(r => !liveIds.has(r.id)).map(r => r.id);
  return { upserts, deletes, added, updated, removed: deletes.length };
}
