import { SOURCES, TYPES } from "../examBuilder";

// Shared by Study and Exam so "which questions" is chosen the same way in
// both. Categories are multi-select and include their sub-categories.

function flattenNonEmpty(tree, counts) {
  const out = [];
  (function walk(nodes) {
    for (const node of nodes) {
      if (!counts.get(node.id)) continue;
      out.push(node);
      walk(node.children);
    }
  })(tree);
  return out;
}

function toggle(list, value) {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

export default function QuestionFilterPicker({ bank, filter, onChange, poolSize }) {
  const rows = flattenNonEmpty(bank.tree, bank.counts);
  const selected = new Set(filter.categoryIds);
  const set = patch => onChange({ ...filter, ...patch });

  // A row whose ancestor is checked is already covered by that ancestor's subtree.
  const coveredByAncestor = new Set();
  for (const node of rows) {
    let parentId = bank.catById.get(node.id)?.parentId;
    while (parentId != null) {
      if (selected.has(parentId)) { coveredByAncestor.add(node.id); break; }
      parentId = bank.catById.get(parentId)?.parentId;
    }
  }

  return (
    <div className="tk-qb-filter-picker">
      <div className="tk-pane tk-qb-filter-categories">
        <label className="tk-pane-label">
          CATEGORIES {filter.categoryIds.length ? `(${filter.categoryIds.length} selected)` : "(all)"}
          {filter.categoryIds.length > 0 && (
            <button type="button" className="tk-qb-link" onClick={() => set({ categoryIds: [] })}>clear</button>
          )}
        </label>
        <div className="tk-qb-checklist">
          {rows.map(node => (
            <label key={node.id} className="tk-qb-check" style={{ paddingLeft: node.depth * 14 }}>
              <input
                type="checkbox"
                checked={selected.has(node.id) || coveredByAncestor.has(node.id)}
                disabled={coveredByAncestor.has(node.id)}
                onChange={() => set({ categoryIds: toggle(filter.categoryIds, node.id) })}
              />
              {node.name} <span className="tk-qb-tree-count">{bank.counts.get(node.id)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="tk-qb-filter-side">
        <div className="tk-pane">
          <label className="tk-pane-label">QUESTIONS</label>
          <select className="tk-input-field" value={filter.source} onChange={e => set({ source: e.target.value })}>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="tk-pane">
          <label className="tk-pane-label">TYPE</label>
          <select className="tk-input-field" value={filter.type} onChange={e => set({ type: e.target.value })}>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        {bank.tags.length > 0 && (
          <div className="tk-pane">
            <label className="tk-pane-label">TAGS (must have all)</label>
            <div className="tk-qb-tag-suggestions">
              {bank.tags.map(t => (
                <button
                  type="button"
                  key={t}
                  className={filter.tags.includes(t) ? "tk-qb-tag-filter--active" : ""}
                  onClick={() => set({ tags: toggle(filter.tags, t) })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="tk-qb-note">{poolSize} question{poolSize === 1 ? "" : "s"} match.</p>
      </div>
    </div>
  );
}
