import { useState, useRef, useCallback } from "react";
import { createOcrWorker, recognizeImage, terminateOcrWorker, downscaleImage } from "../ocr";
import { parseOcrText } from "../parser";
import { saveQuestion } from "../db";
import { findDuplicate, byCategoryId } from "../dedupe";
import ReviewCard from "./ReviewCard";
import CategoryPicker from "./CategoryPicker";
import { loadLastCategoryId, saveLastCategoryId } from "./QuestionForm";

let nextKey = 1;

export default function OcrUpload({ categories, questions, allTags, onTagsChanged, onSaved }) {
  const [files, setFiles] = useState([]); // { id, file, name, status, progress, error }
  const [reviewItems, setReviewItems] = useState([]); // { key, fileName, parsed }
  const [processing, setProcessing] = useState(false);
  const [batchCategoryId, setBatchCategoryId] = useState(loadLastCategoryId);
  const [saveAllSummary, setSaveAllSummary] = useState("");
  const fileInputRef = useRef(null);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList).map(file => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 6)}`,
      file, name: file.name, status: "queued", progress: 0, error: null,
    }));
    setFiles(prev => [...prev, ...picked]);
  };

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id || f.status !== "queued"));

  // Sequential so one huge phone photo doesn't spike memory processing in parallel;
  // each file is isolated in its own try/catch so one unreadable image never blocks the rest.
  const startProcessing = useCallback(async () => {
    setProcessing(true);
    const worker = await createOcrWorker();
    try {
      for (const f of files) {
        if (f.status !== "queued") continue;
        setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "processing" } : x));
        try {
          const image = await downscaleImage(f.file);
          const { text, confidence } = await recognizeImage(worker, image);
          const parsedBlocks = parseOcrText(text).map(p => ({ ...p, ocrConfidence: confidence }));
          setReviewItems(prev => [
            ...prev,
            ...parsedBlocks.map(parsed => ({ key: nextKey++, fileName: f.name, parsed })),
          ]);
          setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "done" } : x));
        } catch (err) {
          setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "error", error: err.message } : x));
        }
      }
    } finally {
      await terminateOcrWorker(worker);
      setProcessing(false);
    }
  }, [files]);

  const removeReviewItem = (key) => setReviewItems(prev => prev.filter(i => i.key !== key));

  const handleCardSave = async (key, question) => {
    saveLastCategoryId(question.categoryId);
    await saveQuestion(question);
    removeReviewItem(key);
    onSaved();
  };

  const parsedReadyCount = reviewItems.filter(i => !i.parsed.needsReview).length;

  const handleSaveAllParsed = async () => {
    if (!batchCategoryId) return;
    const ready = reviewItems.filter(i => !i.parsed.needsReview);
    const localQuestions = questions ? [...questions] : [];
    let added = 0, skipped = 0;
    for (const item of ready) {
      const { needsReview, reason, ...q } = item.parsed;
      const candidate = { ...q, categoryId: batchCategoryId, source: "ocr" };
      if (questions && findDuplicate(localQuestions, candidate, byCategoryId)) {
        skipped++;
        continue;
      }
      const saved = await saveQuestion(candidate);
      localQuestions.push(saved);
      added++;
    }
    setReviewItems(prev => prev.filter(i => i.parsed.needsReview));
    saveLastCategoryId(batchCategoryId);
    setSaveAllSummary(skipped > 0 ? `Saved ${added}, skipped ${skipped} duplicate(s).` : `Saved ${added}.`);
    onSaved();
  };

  return (
    <div className="tk-qb-ocr-upload">
      <div className="tk-qb-ocr-picker-row">
        <label className="tk-file-input-label">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={processing}
            onChange={e => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ""; }}
          />
          <span className="tk-file-input-text">📷 Choose image(s) of MCQ questions</span>
        </label>
        <button className="tk-action-btn" onClick={startProcessing} disabled={processing || files.every(f => f.status !== "queued")}>
          {processing ? "Processing…" : "Run OCR"}
        </button>
      </div>

      {files.length > 0 && (
        <div className="tk-qb-ocr-queue">
          {files.map(f => (
            <div key={f.id} className="tk-qb-ocr-queue-row">
              <span className="tk-qb-ocr-queue-name">{f.name}</span>
              <span className={`tk-qb-badge${f.status === "error" ? " tk-qb-badge--warn" : ""}${f.status === "done" ? " tk-qb-badge--ok" : ""}`}>
                {f.status}
              </span>
              {f.status === "error" && <span className="tk-qb-review-reason">{f.error}</span>}
              {f.status === "queued" && !processing && (
                <button className="tk-qb-tree-danger" onClick={() => removeFile(f.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewItems.length > 0 && (
        <div className="tk-qb-review-batch">
          <div className="tk-qb-ocr-picker-row">
            <label className="tk-pane-label" style={{ marginRight: 4 }}>SAVE ALL PARSED TO</label>
            <CategoryPicker categories={categories} value={batchCategoryId} onChange={setBatchCategoryId} />
            <button className="tk-action-btn" onClick={handleSaveAllParsed} disabled={!batchCategoryId || parsedReadyCount === 0}>
              Save all parsed ({parsedReadyCount})
            </button>
          </div>
          {saveAllSummary && <p className="tk-qb-review-reason">{saveAllSummary}</p>}

          {reviewItems.map(item => (
            <ReviewCard
              key={item.key}
              parsed={item.parsed}
              categories={categories}
              questions={questions}
              allTags={allTags}
              onTagsChanged={onTagsChanged}
              onSave={(question) => handleCardSave(item.key, question)}
              onDiscard={() => removeReviewItem(item.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
