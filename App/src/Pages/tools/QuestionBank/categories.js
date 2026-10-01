// Pure helpers over the flat, parentId-linked category list.

function childrenByParent(categories) {
  const byParent = new Map();
  for (const cat of categories) {
    const key = cat.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(cat);
  }
  return byParent;
}

// Nested tree (children[] + depth), siblings sorted by name.
export function buildCategoryTree(categories) {
  const byParent = childrenByParent(categories);
  function attach(parentId, depth) {
    return (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cat => ({ ...cat, depth, children: attach(cat.id, depth + 1) }));
  }
  return attach(null, 0);
}

// rootId plus every descendant id.
export function collectSubtreeIds(categories, rootId) {
  const byParent = childrenByParent(categories);
  const ids = new Set([rootId]);
  const stack = [rootId];
  while (stack.length) {
    for (const child of byParent.get(stack.pop()) ?? []) {
      if (!ids.has(child.id)) { ids.add(child.id); stack.push(child.id); }
    }
  }
  return ids;
}

// Union of the subtrees of every id in rootIds; null when rootIds is empty
// (meaning "no category restriction").
export function collectSubtreesIds(categories, rootIds) {
  if (!rootIds || rootIds.length === 0) return null;
  const ids = new Set();
  for (const id of rootIds) for (const sub of collectSubtreeIds(categories, id)) ids.add(sub);
  return ids;
}

// Map categoryId → number of questions in that category *or any descendant*.
export function countBySubtree(categories, questions) {
  const byId = new Map(categories.map(c => [c.id, c]));
  const counts = new Map();
  for (const q of questions) {
    let id = q.categoryId;
    const seen = new Set(); // guards against a parentId cycle in bad data
    while (id != null && !seen.has(id)) {
      seen.add(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      id = byId.get(id)?.parentId ?? null;
    }
  }
  return counts;
}

// "English › Grammar › Prepositions"
export function categoryPath(byId, id) {
  const names = [];
  const seen = new Set();
  while (id != null && !seen.has(id)) {
    seen.add(id);
    const cat = byId.get(id);
    if (!cat) break;
    names.unshift(cat.name);
    id = cat.parentId;
  }
  return names.join(" › ");
}
