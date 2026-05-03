import { useState, useEffect } from "react";

// Lightweight markdown renderer — no dependencies
const renderMarkdown = (text) => {
  if (!text) return "";

  let html = text
    // Escape HTML to prevent XSS
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="tk-md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="tk-md-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="tk-md-h1">$1</h1>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="tk-md-hr" />');

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="tk-md-code">$1</code>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="tk-md-blockquote">$1</blockquote>');

  // Unordered lists — collect consecutive lines
  html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (match) => {
    const items = match.trim().split("\n").map(line =>
      `<li>${line.replace(/^[-*+] /, "")}</li>`
    ).join("");
    return `<ul class="tk-md-ul">${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split("\n").map(line =>
      `<li>${line.replace(/^\d+\. /, "")}</li>`
    ).join("");
    return `<ol class="tk-md-ol">${items}</ol>`;
  });

  // Checkboxes
  html = html.replace(/\[x\]/gi, '<span class="tk-md-checkbox tk-md-checked">✓</span>');
  html = html.replace(/\[ \]/g, '<span class="tk-md-checkbox">○</span>');

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="tk-md-link" target="_blank" rel="noopener">$1</a>');

  // Paragraphs — wrap double-newline separated blocks not already in a tag
  html = html.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[1-3]|ul|ol|blockquote|hr)/.test(block)) return block;
    // Single newlines inside a paragraph → <br>
    return `<p class="tk-md-p">${block.replace(/\n/g, "<br />")}</p>`;
  }).join("\n");

  return html;
};

// Strip markdown for plain-text preview
const stripMarkdown = (text) => {
  if (!text) return "";
  return text
    .replace(/#{1,3} /g, "")
    .replace(/\*\*\*?(.+?)\*\*\*?/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*+] /gm, "")
    .replace(/^\d+\. /gm, "")
    .replace(/^> /gm, "")
    .replace(/\[x\]/gi, "✓")
    .replace(/\[ \]/g, "○")
    .replace(/\n/g, " ")
    .trim();
};

const NotesTool = () => {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const STORAGE_KEY = "tk_notes";

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setNotes(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading notes:", e);
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isMaximized) setIsMaximized(false);
        if (expandedId) setExpandedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized, expandedId]);

  const saveToStorage = (notesArray) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesArray));
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("Title cannot be empty");
      return;
    }
    if (editingId) {
      const updated = notes.map(n =>
        n.id === editingId
          ? { ...n, title, content, updated: new Date().toLocaleString() }
          : n
      );
      setNotes(updated);
      saveToStorage(updated);
    } else {
      const newNote = {
        id: Date.now(),
        title,
        content,
        created: new Date().toLocaleString(),
        updated: new Date().toLocaleString(),
      };
      const updated = [newNote, ...notes];
      setNotes(updated);
      saveToStorage(updated);
    }
    setTitle("");
    setContent("");
    setEditingId(null);
    setPreviewMode(false);
  };

  const handleEdit = (note) => {
    setTitle(note.title);
    setContent(note.content);
    setEditingId(note.id);
    setExpandedId(null);
    setPreviewMode(false);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this note?")) {
      const updated = notes.filter(n => n.id !== id);
      setNotes(updated);
      saveToStorage(updated);
      if (editingId === id) {
        setTitle("");
        setContent("");
        setEditingId(null);
      }
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
    setPreviewMode(false);
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <>
      <style>{`
        .tk-md-h1 { font-size: 1.25rem; font-weight: 700; margin: 0.6rem 0 0.3rem; color: var(--tk-accent); letter-spacing: 0.04em; }
        .tk-md-h2 { font-size: 1.05rem; font-weight: 700; margin: 0.5rem 0 0.25rem; color: var(--tk-accent); }
        .tk-md-h3 { font-size: 0.9rem; font-weight: 700; margin: 0.4rem 0 0.2rem; color: var(--tk-text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
        .tk-md-p { margin: 0.25rem 0; font-size: 0.82rem; line-height: 1.6; color: var(--tk-text); }
        .tk-md-hr { border: none; border-top: 1px solid var(--tk-border-bright); margin: 0.6rem 0; }
        .tk-md-ul, .tk-md-ol { margin: 0.3rem 0 0.3rem 1.1rem; padding: 0; font-size: 0.82rem; color: var(--tk-text); }
        .tk-md-ul li, .tk-md-ol li { margin: 0.15rem 0; line-height: 1.5; }
        .tk-md-ul { list-style: none; }
        .tk-md-ul li::before { content: "›"; margin-right: 0.4rem; color: var(--tk-accent); font-weight: 700; }
        .tk-md-ol { list-style: decimal; }
        .tk-md-blockquote { border-left: 2px solid var(--tk-accent); margin: 0.4rem 0; padding: 0.2rem 0.7rem; color: var(--tk-text-dim); font-style: italic; font-size: 0.82rem; }
        .tk-md-code { background: rgba(255,255,255,0.07); border: 1px solid var(--tk-border); border-radius: 3px; padding: 0.1rem 0.35rem; font-family: var(--tk-mono); font-size: 0.75rem; color: var(--tk-accent2, #ff9966); }
        .tk-md-link { color: var(--tk-accent); text-decoration: underline; text-decoration-color: rgba(var(--tk-accent), 0.4); font-size: 0.82rem; }
        .tk-md-link:hover { opacity: 0.8; }
        .tk-md-checkbox { display: inline-flex; align-items: center; justify-content: center; width: 1rem; height: 1rem; border: 1px solid var(--tk-border-bright); border-radius: 2px; font-size: 0.6rem; margin-right: 0.3rem; }
        .tk-md-checked { background: var(--tk-accent); color: var(--tk-bg); border-color: var(--tk-accent); }
        .tk-md-body strong { color: var(--tk-text); }
        .tk-md-body em { color: var(--tk-text-dim); }
        .tk-md-body del { opacity: 0.5; }

        .tk-note-expanded {
          background: var(--tk-surface2);
          border-top: 1px solid var(--tk-border);
          padding: 0.8rem 1rem;
          animation: tk-expand 0.15s ease;
        }
        @keyframes tk-expand { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        .tk-note-expand-btn {
          background: none;
          border: none;
          color: var(--tk-text-dim);
          cursor: pointer;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          padding: 0.15rem 0.4rem;
          border-radius: var(--tk-radius);
          transition: all 0.15s;
          font-family: var(--tk-mono);
        }
        .tk-note-expand-btn:hover { color: var(--tk-accent); background: rgba(255,255,255,0.05); }

        .tk-preview-toggle {
          background: none;
          border: 1px solid var(--tk-border);
          color: var(--tk-text-dim);
          cursor: pointer;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          padding: 0.2rem 0.5rem;
          border-radius: var(--tk-radius);
          font-family: var(--tk-mono);
          transition: all 0.15s;
        }
        .tk-preview-toggle.active { color: var(--tk-accent); border-color: var(--tk-accent); }
        .tk-preview-toggle:hover { border-color: var(--tk-accent); }

        .tk-md-preview-box {
          min-height: 120px;
          padding: 0.8rem 1rem;
          background: rgba(0,0,0,0.15);
          border: 1px solid var(--tk-border);
          border-radius: var(--tk-radius);
          overflow-y: auto;
          flex: 1;
        }
      `}</style>

      <div className={`tk-notes-container ${isMaximized ? "tk-editor-maximized" : ""}`}>

        {/* Editor Panel */}
        <div className={`tk-notes-panel ${isMaximized ? "tk-editor-panel-max" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h3 className="tk-notes-title">
              {editingId ? "EDIT NOTE" : "NEW NOTE"}
            </h3>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                onClick={() => setPreviewMode(v => !v)}
                className={`tk-preview-toggle ${previewMode ? "active" : ""}`}
                title="Toggle markdown preview"
              >
                {previewMode ? "✎ EDIT" : "👁 PREVIEW"}
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="tk-editor-max-btn"
                title={isMaximized ? "Exit fullscreen" : "Fullscreen editor"}
              >
                {isMaximized ? "✕" : "⊞"}
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="tk-input-field"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />

          {previewMode ? (
            <div
              className="tk-md-preview-box tk-md-body"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) || '<p style="color:var(--tk-text-dim);font-size:0.8rem">Nothing to preview yet…</p>' }}
            />
          ) : (
            <textarea
              placeholder={"Note content… (supports **markdown**)\n\n# Heading\n**bold**, *italic*, `code`\n- list item\n> blockquote"}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="tk-textarea-field"
            />
          )}

          <div className="tk-notes-buttons">
            <button onClick={handleSave} className="tk-save-btn">
              {editingId ? "UPDATE" : "CREATE"}
            </button>
            {editingId && (
              <button onClick={handleCancel} className="tk-cancel-btn">
                CANCEL
              </button>
            )}
          </div>
        </div>

        {/* Notes List Panel */}
        <div className={`tk-notes-list ${isMaximized ? "tk-hidden" : ""}`}>
          <h3 className="tk-notes-title">NOTES ({notes.length})</h3>

          <div className="tk-notes-list-container">
            {notes.length === 0 ? (
              <div className="tk-notes-empty">No notes yet. Create one!</div>
            ) : (
              notes.map(note => (
                <div
                  key={note.id}
                  className={`tk-note-item ${editingId === note.id ? "tk-editing" : ""}`}
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  {/* Note header row */}
                  <div
                    style={{ padding: "0.7rem 0.9rem", cursor: "pointer" }}
                    onClick={() => toggleExpand(note.id)}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div className="tk-note-title" style={{ flex: 1 }}>
                        {note.title}
                      </div>
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: "var(--tk-text-dim)",
                          transform: expandedId === note.id ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >▶</span>
                    </div>

                    {/* Preview — plain text, only shown when collapsed */}
                    {expandedId !== note.id && (
                      <div className="tk-note-preview">
                        {stripMarkdown(note.content).substring(0, 60)}
                        {stripMarkdown(note.content).length > 60 ? "…" : ""}
                      </div>
                    )}
                  </div>

                  {/* Expanded markdown body */}
                  {expandedId === note.id && note.content && (
                    <div
                      className="tk-note-expanded tk-md-body"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
                    />
                  )}

                  {/* Meta + actions */}
                  <div className="tk-note-meta" style={{ padding: "0.4rem 0.9rem" }}>
                    <div>{note.updated}</div>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(note); }}
                        className="tk-note-expand-btn"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                        className="tk-note-delete-btn"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default NotesTool;