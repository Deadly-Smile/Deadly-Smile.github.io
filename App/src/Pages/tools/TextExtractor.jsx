import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import { CopyBtn } from "./tk-shared";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for images
const PDF_MAX_SIZE = 1024 * 1024; // 1MB for PDFs
const SUPPORTED_IMAGES = ["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"];

export default function TextExtractor() {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [imagePreview, setImagePreview] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const resetState = () => {
    setPdf(null);
    setImagePreview(null);
    setExtractedText("");
    setSearchQuery("");
    setSearchMatches([]);
    setError("");
    setCurrentPage(1);
    setTotalPages(0);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetState();
    setLoading(true);

    try {
      if (file.type === "application/pdf") {
        if (file.size > PDF_MAX_SIZE) {
          throw new Error(`PDF too large. Max 1MB, yours is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        }
        await loadPdf(file);
      } else if (SUPPORTED_IMAGES.includes(file.type)) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`Image too large. Max 10MB, yours is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        }
        await loadImage(file);
      } else {
        throw new Error("Unsupported file type. Use PDF, PNG, JPG, WebP, BMP, or TIFF.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const loadPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setPdf(pdfDoc);
    setTotalPages(pdfDoc.numPages);
    setCurrentPage(1);
    setLoadingMsg("Extracting text...");
    await extractFullText(pdfDoc);
  };

  const loadImage = async (file) => {
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setLoadingMsg("Running OCR...");

    const { data: { text } } = await Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setLoadingMsg(`OCR: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    setExtractedText(text.trim() || "No text detected in image.");
  };

  const extractFullText = async (pdfDoc) => {
    let fullText = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      fullText += `--- Page ${i} ---\n${textContent.items.map((item) => item.str).join(" ")}\n\n`;
    }
    setExtractedText(fullText);
  };

  useEffect(() => {
    if (!pdf) return;
    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      } catch (err) {
        setError("Failed to render page: " + err.message);
      }
    };
    renderPage();
  }, [pdf, currentPage]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatch(0);
      return;
    }
    const query = searchQuery.toLowerCase();
    const text = extractedText.toLowerCase();
    const matches = [];
    let idx = text.indexOf(query);
    while (idx !== -1) {
      matches.push(idx);
      idx = text.indexOf(query, idx + 1);
    }
    setSearchMatches(matches);
    setCurrentMatch(0);
  }, [searchQuery, extractedText]);

  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getHighlightedText = () => {
    const match = searchMatches[currentMatch];
    const start = Math.max(0, match - 50);
    const end = Math.min(extractedText.length, match + searchQuery.length + 50);
    return (
      `...${extractedText.substring(start, match)}` +
      `[>>> ${extractedText.substring(match, match + searchQuery.length)} <<<]` +
      `${extractedText.substring(match + searchQuery.length, end)}...`
    );
  };

  const handlePaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => SUPPORTED_IMAGES.includes(t));
        if (!imageType) {
          setError("No image found in clipboard.");
          return;
        }
        const blob = await item.getType(imageType);
        if (blob.size > MAX_FILE_SIZE) {
          throw new Error(`Image too large. Max 10MB, yours is ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
        }
        resetState();
        setLoading(true);
        await loadImage(blob);
      }
    } catch (err) {
      // Browser will throw if user denies clipboard permission
      setError(err.name === "NotAllowedError" ? "Clipboard access denied." : err.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  return (
    <div className="tk-pdf-container">
      <div className="tk-pdf-upload">
        <label className="tk-file-input-label">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif"
            onChange={handleFileUpload}
            disabled={loading}
          />
          <span className="tk-file-input-text">
            {loading ? loadingMsg || "Loading..." : "📄 Choose PDF or Image (PNG, JPG, WebP, BMP, TIFF)"}
          </span>
        </label>
        <button
          onClick={handlePaste}
          disabled={loading}
          className="tk-nav-page-btn"
          style={{ marginTop: 8 }}
        >
          📋 Paste from Clipboard
        </button>
        {error && <div className="tk-error">{error}</div>}
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="tk-pdf-canvas-wrapper">
          <img src={imagePreview} alt="Uploaded" style={{ maxWidth: "100%", borderRadius: 8 }} />
        </div>
      )}

      {/* PDF canvas + controls */}
      {pdf && (
        <div className="tk-pdf-content">
          <div className="tk-pdf-canvas-wrapper">
            <canvas ref={canvasRef} className="tk-pdf-canvas" />
            <div className="tk-pdf-info">Page {currentPage} of {totalPages}</div>
          </div>
          <div className="tk-pdf-controls">
            <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="tk-nav-page-btn">⏮ First</button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="tk-nav-page-btn">◀ Prev</button>
            <input
              type="number" min="1" max={totalPages} value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="tk-page-input"
            />
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="tk-nav-page-btn">Next ▶</button>
            <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="tk-nav-page-btn">Last ⏭</button>
          </div>
        </div>
      )}

      {/* Search + extracted text — shown for both PDF and image */}
      {extractedText && (
        <div className="tk-pdf-content">
          <div className="tk-pdf-search">
            <input
              type="text"
              placeholder="🔍 Search in extracted text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tk-search-input"
            />
            {searchMatches.length > 0 && (
              <div className="tk-search-info">
                Match {currentMatch + 1} of {searchMatches.length}
                <button onClick={() => setCurrentMatch((p) => (p + 1) % searchMatches.length)} className="tk-search-nav-btn">
                  Next
                </button>
              </div>
            )}
          </div>
          <div className="tk-pdf-text-section">
            <h3>📝 Extracted Text</h3>
            <div className="tk-pdf-text-display">
              <pre>{searchQuery && searchMatches.length > 0 ? getHighlightedText() : extractedText}</pre>
            </div>
            <CopyBtn getText={() => extractedText} label="Copy All Text" />
          </div>
        </div>
      )}
    </div>
  );
}