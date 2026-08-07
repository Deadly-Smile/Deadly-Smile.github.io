import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { getAllCategories, getAllQuestions, getAllTags, saveQuestion, deleteQuestion, importBank, collectSubtreeIds } from "./db";
import { downloadBankAsJson, parseBankJson } from "./export";
import { findDuplicate, byCategoryId } from "./dedupe";
import CategoryTree from "./components/CategoryTree";
import QuestionForm from "./components/QuestionForm";
import QuestionList from "./components/QuestionList";
import OcrUpload from "./components/OcrUpload";
import SyncPanel from "./components/SyncPanel";
import StudyPanel from "./components/StudyPanel";
import ExamPanel from "./components/ExamPanel";
import StatsPanel from "./components/StatsPanel";

const TABS = [
  { id: "browse", label: "Browse" },
  { id: "add", label: "Add" },
  { id: "import", label: "Import (OCR)" },
  { id: "study", label: "Study" },
  { id: "exam", label: "Exam" },
  { id: "stats", label: "Stats" },
  { id: "sync", label: "Sync" },
];

export default function QuestionBank() {
  const [searchParams] = useSearchParams();
  const autoJoinRoomId = searchParams.get("sync")?.toUpperCase() || null;
  const [activeTab, setActiveTab] = useState(autoJoinRoomId ? "sync" : "browse");
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState("");
  const importInputRef = useRef(null);

  const refresh = useCallback(async () => {
    const [cats, qs, tgs] = await Promise.all([getAllCategories(), getAllQuestions(), getAllTags()]);
    setCategories(cats);
    setQuestions(qs);
    setTags(tgs);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // A sub-category's questions also belong to its ancestor categories, so
  // selecting a parent shows everything nested under it, not just direct hits.
  const visibleQuestions = useMemo(() => {
    if (selectedCategoryId === null) return questions;
    const allowed = collectSubtreeIds(categories, selectedCategoryId);
    return questions.filter(q => allowed.has(q.categoryId));
  }, [questions, categories, selectedCategoryId]);

  async function handleDeleteQuestion(id) {
    await deleteQuestion(id);
    refresh();
  }

  async function handleSaveQuestion(question) {
    await saveQuestion(question);
    await refresh();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportStatus("Importing…");
    try {
      const bankData = parseBankJson(await file.text());
      const result = await importBank(bankData);
      setImportStatus(
        `Imported: ${result.addedQuestions} question(s) added, ${result.skippedQuestions} skipped as duplicates, ${result.addedCategories} new categor${result.addedCategories === 1 ? "y" : "ies"}, ${result.addedTags} new tag(s).`
      );
      await refresh();
    } catch (err) {
      setImportStatus(`Import failed: ${err.message}`);
    }
  }

  function checkQuestionDuplicate(candidate) {
    return findDuplicate(questions, candidate, byCategoryId);
  }

  if (loading) {
    return <div className="tk-qb-root"><p className="tk-qb-tree-empty">Loading question bank…</p></div>;
  }

  return (
    <div className="tk-qb-root">
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Question Bank</h2>
        <div className="tk-tool-actions">
          <button className="tk-action-btn" onClick={() => downloadBankAsJson(categories, questions, tags)}>
            Export JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
          <button className="tk-action-btn" onClick={() => importInputRef.current.click()}>
            Import JSON
          </button>
        </div>
      </div>
      {importStatus && <p className="tk-qb-review-reason">{importStatus}</p>}

      <div className="tk-qb-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tk-qb-tab${activeTab === t.id ? " tk-active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "browse" && (
        <div className="tk-qb-browse-layout">
          <div className="tk-qb-browse-sidebar">
            <CategoryTree
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              onRefresh={refresh}
            />
          </div>
          <div className="tk-qb-browse-main">
            <QuestionList
              questions={visibleQuestions}
              categories={categories}
              tags={tags}
              onDelete={handleDeleteQuestion}
              onChanged={refresh}
            />
          </div>
        </div>
      )}

      {activeTab === "add" && (
        <div className="tk-qb-add-layout">
          {categories.length === 0 ? (
            <p className="tk-qb-tree-empty">Create a category in the Browse tab before adding questions.</p>
          ) : (
            <QuestionForm
              categories={categories}
              allTags={tags}
              onTagsChanged={refresh}
              onSave={handleSaveQuestion}
              submitLabel="Save question"
              checkDuplicate={checkQuestionDuplicate}
            />
          )}
        </div>
      )}

      {activeTab === "import" && (
        categories.length === 0 ? (
          <p className="tk-qb-tree-empty">Create a category in the Browse tab before importing questions.</p>
        ) : (
          <OcrUpload categories={categories} questions={questions} allTags={tags} onTagsChanged={refresh} onSaved={refresh} />
        )
      )}

      {activeTab === "study" && (
        <StudyPanel categories={categories} questions={questions} tags={tags} onChanged={refresh} />
      )}

      {activeTab === "exam" && (
        <ExamPanel categories={categories} questions={questions} tags={tags} />
      )}

      {activeTab === "stats" && (
        <StatsPanel categories={categories} questions={questions} />
      )}

      {activeTab === "sync" && (
        <SyncPanel onSynced={refresh} autoJoinRoomId={autoJoinRoomId} />
      )}
    </div>
  );
}
