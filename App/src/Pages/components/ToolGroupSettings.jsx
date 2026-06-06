import { useState, useRef } from "react";
import Modal from "./Modal";

const DEFAULT_GROUPS      = ["General", "Dev", "Utilities", "Others"];
const DEFAULT_ASSIGNMENTS = {
  magic:  "Others",
  notes:  "General",
  calc:   "General",
  word:   "General",
  image:  "General",
  video:  "General",
  json:   "Dev",
  regex:  "Dev",
  base64: "Dev",
  jwt:    "Dev",
  hash:   "Dev",
  http:   "Dev",
  cron:   "Dev",
  html:   "Dev",
  code:   "Dev",
  color:  "Utilities",
  diff:   "Utilities",
  time:   "Utilities",
  qr:     "Utilities",
  csv:    "Utilities",
  pass:   "Utilities",
  pdf:    "Utilities",
};

export { DEFAULT_GROUPS, DEFAULT_ASSIGNMENTS };

const ToolGroupSettings = ({ allTools, config, onSave, onClose }) => {
  const [groups,      setGroups]      = useState([...config.groups]);
  const [assignments, setAssignments] = useState({ ...config.assignments });
  const [newName,     setNewName]     = useState("");
  const inputRef = useRef(null);

  const ungrouped = allTools.filter(t => !groups.includes(assignments[t.id]));

  function addGroup() {
    const name = newName.trim();
    if (!name || groups.includes(name)) return;
    setGroups(prev => [...prev, name]);
    setNewName("");
    inputRef.current?.focus();
  }

  function removeGroup(name) {
    const next = { ...assignments };
    allTools.forEach(t => { if (next[t.id] === name) delete next[t.id]; });
    setGroups(prev => prev.filter(g => g !== name));
    setAssignments(next);
  }

  function assign(toolId, group) {
    setAssignments(prev => ({ ...prev, [toolId]: group }));
  }

  function unassign(toolId) {
    setAssignments(prev => {
      const next = { ...prev };
      delete next[toolId];
      return next;
    });
  }

  function handleReset() {
    setGroups([...DEFAULT_GROUPS]);
    setAssignments({ ...DEFAULT_ASSIGNMENTS });
  }

  function handleSave() {
    onSave({ groups, assignments });
    onClose();
  }

  const actions = (
    <>
      <button className="tk-cancel-btn" onClick={onClose}>Cancel</button>
      <button className="tk-modal-close" onClick={handleSave}>Save</button>
    </>
  );

  return (
    <Modal title="Configure Groups" onClose={onClose} width="700px" actions={actions}>

      <p className="tk-sg-desc">
        Assign tools to groups — they appear in the sidebar under those labels.
        Tools left unassigned are hidden.
      </p>

      {/* ── Add group ── */}
      <div className="tk-sg-add-row">
        <input
          ref={inputRef}
          className="tk-sg-name-input"
          placeholder="New group name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addGroup()}
        />
        <button className="tk-action-btn" onClick={addGroup}>Add group</button>
        <button className="tk-sg-reset-btn" onClick={handleReset}>Reset defaults</button>
      </div>

      {/* ── Assignment table ── */}
      <div className="tk-sg-table-wrap">
        <table className="tk-sg-table">
          <thead>
            <tr>
              <th className="tk-sg-th tk-sg-th--tool">Tool</th>
              {groups.map(g => (
                <th key={g} className="tk-sg-th">
                  <div className="tk-sg-group-head">
                    <span>{g}</span>
                    <button
                      className="tk-sg-remove-group"
                      onClick={() => removeGroup(g)}
                      title={`Remove "${g}"`}
                    >✕</button>
                  </div>
                </th>
              ))}
              <th className="tk-sg-th tk-sg-th--none" title="Unassigned / hidden">—</th>
            </tr>
          </thead>
          <tbody>
            {allTools.map(tool => {
              const isUnassigned = !assignments[tool.id] || !groups.includes(assignments[tool.id]);
              return (
                <tr key={tool.id} className={isUnassigned ? "tk-sg-row--warn" : ""}>
                  <td className="tk-sg-td tk-sg-td--label">{tool.label}</td>
                  {groups.map(g => (
                    <td key={g} className="tk-sg-td tk-sg-td--radio">
                      <input
                        type="radio"
                        name={tool.id}
                        checked={assignments[tool.id] === g}
                        onChange={() => assign(tool.id, g)}
                      />
                    </td>
                  ))}
                  <td className="tk-sg-td tk-sg-td--radio">
                    <input
                      type="radio"
                      name={tool.id}
                      checked={isUnassigned}
                      onChange={() => unassign(tool.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Unassigned warning ── */}
      {ungrouped.length > 0 && (
        <div className="tk-sg-warn-box">
          <span className="tk-sg-warn-label">Hidden ({ungrouped.length})</span>
          <div className="tk-sg-chip-row">
            {ungrouped.map(t => (
              <span key={t.id} className="tk-sg-chip tk-sg-chip--warn">{t.label}</span>
            ))}
          </div>
        </div>
      )}

    </Modal>
  );
}

export default ToolGroupSettings;