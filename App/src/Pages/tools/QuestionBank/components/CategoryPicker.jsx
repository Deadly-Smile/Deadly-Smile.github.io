import { buildCategoryTree } from "../db";

function flatten(tree) {
  const out = [];
  for (const node of tree) {
    out.push(node);
    out.push(...flatten(node.children));
  }
  return out;
}

export default function CategoryPicker({ categories, value, onChange, className }) {
  const flat = flatten(buildCategoryTree(categories));

  if (flat.length === 0) {
    return <p className="tk-qb-tree-empty">No categories yet — create one in the Browse tab first.</p>;
  }

  return (
    <select
      className={className ?? "tk-input-field"}
      value={value ?? ""}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="" disabled>Select a category…</option>
      {flat.map(cat => (
        <option key={cat.id} value={cat.id}>{"  ".repeat(cat.depth)}{cat.name}</option>
      ))}
    </select>
  );
}
