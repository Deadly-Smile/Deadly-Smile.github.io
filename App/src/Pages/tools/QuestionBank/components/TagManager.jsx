import { useState } from "react";
import { renameTag, deleteTag } from "../db";
import { ConfirmModal } from "../../../../Utils/Modal";

// Flat rename/delete list, opened inline from TagPicker — tags have no
// hierarchy so this doesn't need CategoryTree's expand/collapse machinery.
export default function TagManager({ tags, onChanged }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  async function commitRename(id) {
    const name = renameValue.trim();
    if (name) await renameTag(id, name);
    setRenamingId(null);
    onChanged();
  }

  async function confirmDelete() {
    await deleteTag(pendingDelete.id);
    setPendingDelete(null);
    onChanged();
  }

  return (
    <div className="tk-qb-tag-manager-panel">
      {tags.length === 0 ? (
        <p className="tk-qb-tree-empty">No tags yet.</p>
      ) : (
        tags.map(t => (
          <div key={t.id} className="tk-qb-tag-manager-row">
            {renamingId === t.id ? (
              <input
                className="tk-qb-tree-input"
                value={renameValue}
                autoFocus
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && commitRename(t.id)}
                onBlur={() => commitRename(t.id)}
              />
            ) : (
              <span className="tk-qb-tree-label">{t.name}</span>
            )}
            <button type="button" onClick={() => { setRenamingId(t.id); setRenameValue(t.name); }}>✎</button>
            <button type="button" className="tk-qb-tree-danger" onClick={() => setPendingDelete(t)}>✕</button>
          </div>
        ))
      )}

      <ConfirmModal
        isOpen={!!pendingDelete}
        title="Delete tag?"
        message={pendingDelete && `"${pendingDelete.name}" will be removed from all questions that have it.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        danger
      />
    </div>
  );
}
