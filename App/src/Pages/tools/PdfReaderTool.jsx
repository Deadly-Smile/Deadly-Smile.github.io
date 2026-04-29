import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { CopyBtn } from "./tk-shared";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export default function PdfReaderTool() {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large! Max size is 1MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      setError("Please upload a valid PDF file");
      return;
    }

    setError("");
    setLoading(true);
    setExtractedText("");
    setSearchQuery("");
    setSearchMatches([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdf(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);

      // Extract text from entire document on load
      await extractFullText(pdfDoc);
    } catch (err) {
      setError("Failed to load PDF: " + err.message);
      setPdf(null);
    } finally {
      setLoading(false);
    }
  };

  // Extract text from entire PDF
  const extractFullText = async (pdfDoc) => {
    try {
      let fullText = "";
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      setExtractedText(fullText);
    } catch (err) {
      console.error("Text extraction error:", err);
    }
  };

  // Render current page
  useEffect(() => {
    if (!pdf) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext("2d");
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        setError("Failed to render page: " + err.message);
      }
    };

    renderPage();
  }, [pdf, currentPage]);

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatch(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const text = extractedText.toLowerCase();
    const matches = [];
    let index = text.indexOf(query);

    while (index !== -1) {
      matches.push(index);
      index = text.indexOf(query, index + 1);
    }

    setSearchMatches(matches);
    setCurrentMatch(0);
  }, [searchQuery, extractedText]);

  // Page navigation
  const goToPage = (page) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
  };

  const getHighlightedText = () => {
    if (!searchQuery || searchMatches.length === 0) {
      return extractedText;
    }

    const match = searchMatches[currentMatch];
    const start = Math.max(0, match - 50);
    const end = Math.min(extractedText.length, match + searchQuery.length + 50);
    const before = extractedText.substring(start, match);
    const highlight = extractedText.substring(match, match + searchQuery.length);
    const after = extractedText.substring(match + searchQuery.length, end);

    return `...${before}[>>> ${highlight} <<<]${after}...`;
  };

  return (
    <div className="tk-pdf-container">
      <div className="tk-pdf-upload">
        <label className="tk-file-input-label">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={loading}
          />
          <span className="tk-file-input-text">
            {loading ? "Loading..." : "📄 Choose PDF or Drag & Drop"}
          </span>
        </label>
        {error && <div className="tk-error">{error}</div>}
      </div>

      {pdf && (
        <div className="tk-pdf-content">
          {/* Canvas for PDF rendering */}
          <div className="tk-pdf-canvas-wrapper">
            <canvas ref={canvasRef} className="tk-pdf-canvas"></canvas>
            <div className="tk-pdf-info">
              Page {currentPage} of {totalPages}
            </div>
          </div>

          {/* Page Navigation */}
          <div className="tk-pdf-controls">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="tk-nav-page-btn"
            >
              ⏮ First
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="tk-nav-page-btn"
            >
              ◀ Prev
            </button>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="tk-page-input"
            />
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="tk-nav-page-btn"
            >
              Next ▶
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="tk-nav-page-btn"
            >
              Last ⏭
            </button>
          </div>

          {/* Search in extracted text */}
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
                <button
                  onClick={() => setCurrentMatch((p) => (p + 1) % searchMatches.length)}
                  className="tk-search-nav-btn"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Extracted text display */}
          <div className="tk-pdf-text-section">
            <h3>📝 Extracted Text</h3>
            <div className="tk-pdf-text-display">
              {searchQuery && searchMatches.length > 0 ? (
                <pre>{getHighlightedText()}</pre>
              ) : (
                <pre>{extractedText || "No text extracted"}</pre>
              )}
            </div>
            <CopyBtn
              getText={() => extractedText}
              label="Copy All Text"
            />
          </div>
        </div>
      )}
    </div>
  );
}
