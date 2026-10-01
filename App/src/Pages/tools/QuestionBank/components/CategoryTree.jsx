import { useState } from "react";

// Read-only category navigator. Counts include sub-categories; empty
// branches are hidden unless showEmpty is on (most of the ~600 categories
// have no questions yet).

function initiallyExpanded(tree, selectedId) {
  // Open the path down to the selected category so it's visible on load.
  const open = new Set();
  function walk(nodes, path) {
    for (const node of nodes) {
      if (node.id === selectedId) { path.forEach(id => open.add(id)); return true; }
      if (walk(node.children, [...path, node.id])) return true;
    }
    return false;
  }
  if (selectedId != null) walk(tree, []);
  return open;
}

function TreeNode({ node, counts, showEmpty, selectedId, onSelect, expanded, onToggle }) {
  const visibleChildren = showEmpty ? node.children : node.children.filter(c => counts.get(c.id));
  const isOpen = expanded.has(node.id);

  return (
    <div className="tk-qb-tree-node">
      <div
        className={`tk-qb-tree-row${selectedId === node.id ? " tk-qb-tree-row--active" : ""}`}
        style={{ paddingLeft: node.depth * 14 }}
      >
        <button
          className="tk-qb-tree-toggle"
          onClick={() => onToggle(node.id)}
          disabled={visibleChildren.length === 0}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {visibleChildren.length > 0 ? (isOpen ? "▾" : "▸") : "·"}
        </button>
        <span className="tk-qb-tree-label" onClick={() => onSelect(node.id)}>{node.name}</span>
        <span className="tk-qb-tree-count">{counts.get(node.id) ?? 0}</span>
      </div>
      {isOpen && visibleChildren.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          counts={counts}
          showEmpty={showEmpty}
          selectedId={selectedId}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

export default function CategoryTree({ bank, selectedId, onSelect }) {
  const [expanded, setExpanded] = useState(() => initiallyExpanded(bank.tree, selectedId));
  const [showEmpty, setShowEmpty] = useState(false);
  const roots = showEmpty ? bank.tree : bank.tree.filter(n => bank.counts.get(n.id));

  function toggle(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="tk-qb-tree">
      <div className={`tk-qb-tree-row${selectedId === null ? " tk-qb-tree-row--active" : ""}`}>
        <button className="tk-qb-tree-toggle" disabled>·</button>
        <span className="tk-qb-tree-label" onClick={() => onSelect(null)}>All questions</span>
        <span className="tk-qb-tree-count">{bank.questions.length}</span>
      </div>

      {roots.length === 0 ? (
        <p className="tk-qb-tree-empty">No categories yet.</p>
      ) : (
        roots.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            counts={bank.counts}
            showEmpty={showEmpty}
            selectedId={selectedId}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={toggle}
          />
        ))
      )}

      <label className="tk-qb-check tk-qb-tree-footer">
        <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
        Show empty categories
      </label>
    </div>
  );
}
