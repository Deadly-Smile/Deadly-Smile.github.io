import { buildCategoryTree, collectSubtreeIds } from "../db";

function flatten(tree) {
  const out = [];
  for (const node of tree) {
    out.push(node);
    out.push(...flatten(node.children));
  }
  return out;
}

// Shared by StudyPanel and ExamPanel so "filter by category+subcategory+tag"
// is one implementation, not two that can drift.
export function filterQuestions(questions, categories, { categoryId, tagIds }) {
  let pool = questions;
  if (categoryId != null) {
    const allowed = collectSubtreeIds(categories, categoryId);
    pool = pool.filter(q => allowed.has(q.categoryId));
  }
  if (tagIds && tagIds.length > 0) {
    pool = pool.filter(q => tagIds.every(tid => (q.tagIds ?? []).includes(tid)));
  }
  return pool;
}

export default function QuestionFilterPicker({ categories, tags, categoryId, onCategoryChange, tagIds, onTagIdsChange }) {
  const flat = flatten(buildCategoryTree(categories));

  function toggleTag(id) {
    onTagIdsChange(tagIds.includes(id) ? tagIds.filter(t => t !== id) : [...tagIds, id]);
  }

  return (
    <div className="tk-qb-filter-picker">
      <div className="tk-pane">
        <label className="tk-pane-label">CATEGORY (includes sub-categories)</label>
        <select
          className="tk-input-field"
          value={categoryId ?? ""}
          onChange={e => onCategoryChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All categories</option>
          {flat.map(cat => (
            <option key={cat.id} value={cat.id}>{"  ".repeat(cat.depth)}{cat.name}</option>
          ))}
        </select>
      </div>

      {tags.length > 0 && (
        <div className="tk-pane">
          <label className="tk-pane-label">TAGS (must have all selected)</label>
          <div className="tk-qb-tag-suggestions">
            {tags.map(t => (
              <button
                type="button"
                key={t.id}
                className={tagIds.includes(t.id) ? "tk-qb-tag-filter--active" : ""}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
