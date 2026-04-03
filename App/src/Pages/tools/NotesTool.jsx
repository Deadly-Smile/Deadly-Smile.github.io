import { useState, useEffect } from "react";

const NotesTool = () => {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const STORAGE_KEY = "tk_notes";

  // Load notes from localStorage
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

  // Handle Escape key to exit maximize
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  const saveToStorage = (notesArray) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesArray));
  };

  // Create or Update
  const handleSave = () => {
    if (!title.trim()) {
      alert("Title cannot be empty");
      return;
    }

    if (editingId) {
      // Update existing note
      const updated = notes.map(n =>
        n.id === editingId
          ? { ...n, title, content, updated: new Date().toLocaleString() }
          : n
      );
      setNotes(updated);
      saveToStorage(updated);
    } else {
      // Create new note
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
  };

  // Read (Edit)
  const handleEdit = (note) => {
    setTitle(note.title);
    setContent(note.content);
    setEditingId(note.id);
  };

  // Delete
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
    }
  };

  // Cancel edit
  const handleCancel = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
  };

  return (
    <div className={`tk-notes-container ${isMaximized ? "tk-editor-maximized" : ""}`}>
      {/* Editor Panel */}
      <div className={`tk-notes-panel ${isMaximized ? "tk-editor-panel-max" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 className="tk-notes-title">
            {editingId ? "EDIT NOTE" : "NEW NOTE"}
          </h3>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="tk-editor-max-btn"
            title={isMaximized ? "Exit fullscreen" : "Fullscreen editor"}
          >
            {isMaximized ? "✕" : "⊞"}
          </button>
        </div>

        <input
          type="text"
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="tk-input-field"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />

        <textarea
          placeholder="Note content..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="tk-textarea-field"
        />

        <div className="tk-notes-buttons">
          <button
            onClick={handleSave}
            className="tk-save-btn"
          >
            {editingId ? "UPDATE" : "CREATE"}
          </button>

          {editingId && (
            <button
              onClick={handleCancel}
              className="tk-cancel-btn"
            >
              CANCEL
            </button>
          )}
        </div>
      </div>

      {/* Notes List Panel */}
      <div className={`tk-notes-list ${isMaximized ? "tk-hidden" : ""}`}>
        <h3 className="tk-notes-title">
          NOTES ({notes.length})
        </h3>

        <div className="tk-notes-list-container">
          {notes.length === 0 ? (
            <div className="tk-notes-empty">
              No notes yet. Create one!
            </div>
          ) : (
            notes.map(note => (
              <div
                key={note.id}
                className={`tk-note-item ${editingId === note.id ? "tk-editing" : ""}`}
              >
                <div onClick={() => handleEdit(note)}>
                  <div className="tk-note-title">
                    {note.title}
                  </div>
                  <div className="tk-note-preview">
                    {note.content && note.content.substring(0, 50)}
                    {note.content && note.content.length > 50 ? "..." : ""}
                  </div>
                </div>

                <div className="tk-note-meta">
                  <div>
                    {note.updated}
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="tk-note-delete-btn"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesTool;
