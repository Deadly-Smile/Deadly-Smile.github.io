import { useState } from "react";
import { getOrCreateTag } from "../db";
import TagManager from "./TagManager";

export default function TagPicker({ allTags, selectedIds, onChange, onTagsChanged }) {
  const [input, setInput] = useState("");
  const [managing, setManaging] = useState(false);

  const selected = allTags.filter(t => selectedIds.includes(t.id));
  const query = input.trim().toLowerCase();
  const suggestions = allTags.filter(t => !selectedIds.includes(t.id) && (!query || t.name.toLowerCase().includes(query)));
  const exactMatch = allTags.find(t => t.name.toLowerCase() === query);

  function addTagId(id) {
    onChange([...selectedIds, id]);
    setInput("");
  }

  function removeTagId(id) {
    onChange(selectedIds.filter(x => x !== id));
  }

  async function createAndAdd() {
    const name = input.trim();
    if (!name) return;
    const tag = await getOrCreateTag(name);
    onTagsChanged();
    addTagId(tag.id);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (exactMatch) addTagId(exactMatch.id);
    else createAndAdd();
  }

  return (
    <div className="tk-qb-tagpicker">
      <div className="tk-qb-tag-chips">
        {selected.map(t => (
          <span key={t.id} className="tk-qb-tag-chip">
            {t.name}
            <button type="button" onClick={() => removeTagId(t.id)}>✕</button>
          </span>
        ))}
        <input
          className="tk-qb-tag-input"
          value={input}
          placeholder="Add a tag…"
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {input.trim() && (
        <div className="tk-qb-tag-suggestions">
          {suggestions.slice(0, 6).map(t => (
            <button type="button" key={t.id} onClick={() => addTagId(t.id)}>{t.name}</button>
          ))}
          {!exactMatch && (
            <button type="button" onClick={createAndAdd}>+ Create "{input.trim()}"</button>
          )}
        </div>
      )}

      <button type="button" className="tk-qb-tag-manage-link" onClick={() => setManaging(v => !v)}>
        {managing ? "Close tag manager" : "Manage tags…"}
      </button>

      {managing && (
        <TagManager tags={allTags} onChanged={onTagsChanged} />
      )}
    </div>
  );
}
