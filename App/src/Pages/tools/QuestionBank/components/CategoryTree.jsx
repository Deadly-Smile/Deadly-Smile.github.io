import { useState } from "react";
import { addCategory, renameCategory, deleteCategory, buildCategoryTree } from "../db";
import { ConfirmModal } from "../../../../Utils/Modal";

function TreeNode({ node, selectedId, onSelect, expanded, onToggle, onRefresh, onRequestDelete }) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const isOpen = expanded.has(node.id);

  const commitRename = async () => {
    const name = renameValue.trim();
    if (name && name !== node.name) await renameCategory(node.id, name);
    setRenaming(false);
    onRefresh();
  };

  const commitAddChild = async () => {
    const name = childName.trim();
    if (name) {
      await addCategory(name, node.id);
      onToggle(node.id, true);
      onRefresh();
    }
    setAddingChild(false);
    setChildName("");
  };

  return (
    <div className="tk-qb-tree-node" style={{ paddingLeft: node.depth * 16 }}>
      <div className={`tk-qb-tree-row${selectedId === node.id ? " tk-qb-tree-row--active" : ""}`}>
        <button
          className="tk-qb-tree-toggle"
          onClick={() => onToggle(node.id)}
          disabled={node.children.length === 0}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {node.children.length > 0 ? (isOpen ? "▾" : "▸") : "·"}
        </button>

        {renaming ? (
          <input
            className="tk-qb-tree-input"
            value={renameValue}
            autoFocus
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
            onBlur={commitRename}
          />
        ) : (
          <span className="tk-qb-tree-label" onClick={() => onSelect(node.id)}>{node.name}</span>
        )}

        <span className="tk-qb-tree-actions">
          <button title="Add sub-category" onClick={() => setAddingChild(v => !v)}>+</button>
          <button title="Rename" onClick={() => setRenaming(true)}>✎</button>
          <button title="Delete" className="tk-qb-tree-danger" onClick={() => onRequestDelete(node)}>✕</button>
        </span>
      </div>

      {addingChild && (
        <div className="tk-qb-tree-add-row" style={{ paddingLeft: (node.depth + 1) * 16 }}>
          <input
            className="tk-qb-tree-input"
            placeholder="Sub-category name…"
            value={childName}
            autoFocus
            onChange={e => setChildName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitAddChild(); if (e.key === "Escape") setAddingChild(false); }}
            onBlur={commitAddChild}
          />
        </div>
      )}

      {isOpen && node.children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
          onRefresh={onRefresh}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}

export default function CategoryTree({ categories, selectedId, onSelect, onRefresh }) {
  const [expanded, setExpanded] = useState(new Set());
  const [newRootName, setNewRootName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null); // { node, blocked info } once checked
  const [confirming, setConfirming] = useState(false);

  const tree = buildCategoryTree(categories);

  function toggle(id, forceOpen) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (forceOpen || !next.has(id)) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function addRoot() {
    const name = newRootName.trim();
    if (!name) return;
    await addCategory(name, null);
    setNewRootName("");
    onRefresh();
  }

  async function requestDelete(node) {
    const result = await deleteCategory(node.id, { cascade: false });
    if (result.blocked) {
      setDeleteTarget({ node, ...result });
      setConfirming(true);
    } else {
      if (selectedId === node.id) onSelect(null);
      onRefresh();
    }
  }

  async function confirmCascadeDelete() {
    if (!deleteTarget) return;
    await deleteCategory(deleteTarget.node.id, { cascade: true });
    if (selectedId === deleteTarget.node.id) onSelect(null);
    setDeleteTarget(null);
    onRefresh();
  }

  return (
    <div className="tk-qb-tree">
      <div className="tk-qb-tree-add-row">
        <input
          className="tk-qb-tree-input"
          placeholder="New top-level category…"
          value={newRootName}
          onChange={e => setNewRootName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addRoot()}
        />
        <button className="tk-action-btn" onClick={addRoot}>Add</button>
      </div>

      <div
        className={`tk-qb-tree-row${selectedId === null ? " tk-qb-tree-row--active" : ""}`}
        style={{ marginTop: 4 }}
      >
        <button className="tk-qb-tree-toggle" disabled>·</button>
        <span className="tk-qb-tree-label" onClick={() => onSelect(null)}>All questions</span>
      </div>

      {tree.length === 0 ? (
        <p className="tk-qb-tree-empty">No categories yet — add one above.</p>
      ) : (
        tree.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={toggle}
            onRefresh={onRefresh}
            onRequestDelete={requestDelete}
          />
        ))
      )}

      <ConfirmModal
        isOpen={confirming}
        title="Category is not empty"
        message={deleteTarget && (
          <>
            "{deleteTarget.node.name}" contains {deleteTarget.categoryCount} sub-categor{deleteTarget.categoryCount === 1 ? "y" : "ies"} and{" "}
            {deleteTarget.questionCount} question{deleteTarget.questionCount === 1 ? "" : "s"}. Delete it along with everything inside it?
          </>
        )}
        onClose={() => { setConfirming(false); setDeleteTarget(null); }}
        onConfirm={confirmCascadeDelete}
        danger
      />
    </div>
  );
}
