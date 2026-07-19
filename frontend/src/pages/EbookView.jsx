import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";

import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js";

export default function EbookView() {
  const { id } = useParams();

  const [book, setBook] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  const token = localStorage.getItem("token");
  const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  const pdfOptions = useMemo(
    () => ({ cMapUrl: "cmaps/", cMapPacked: true }),
    []
  );

  const pageWidth = useMemo(
    () => Math.min(window.innerWidth - 32, 900),
    []
  );

  useEffect(() => {
    // reset view state whenever we navigate to a different book,
    // otherwise the previous book's page number/count can linger
    setBook(null);
    setNumPages(null);
    setPageNumber(1);
    setPageInput("1");
    fetchBook();
  }, [id]);

  // keep the input box in sync when page changes via the buttons
  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  const fetchBook = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/books/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      const data = await res.json();
      setBook(data);
    } catch (err) {
      console.error("Failed to load ebook:", err);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const goToPage = () => {
    const parsed = parseInt(pageInput, 10);
    if (!numPages || isNaN(parsed)) {
      setPageInput(String(pageNumber));
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), numPages);
    setPageNumber(clamped);
    setPageInput(String(clamped));
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goToPage();
      e.target.blur();
    }
  };

  if (!book) {
    return (
      <div className="loading">
        Loading book...
      </div>
    );
  }

  const coverUrl = book.cover_image
    ? `${baseUrl}${book.cover_image}`
    : "/placeholder-book.png";

  const pdfUrl = `${baseUrl}/api/books/view/${book.id}`;

  const pdfFile = {
    url: pdfUrl,
    httpHeaders: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
    },
    withCredentials: false,
  };

  return (
    <>
      {/* Sidebar (now controlled properly) */}
      <Sidebar />

      <div className="page">
        <div className="container">

          {/* BOOK INFO */}
          <div className="ebook-card">
            <img
              src={coverUrl}
              alt={book.title}
              className="cover"
              onError={(e) => (e.target.src = "/placeholder-book.png")}
            />

            <div className="info">
              <h2>{book.title}</h2>
              <p><strong>Author:</strong> {book.author}</p>
              {book.section && <p><strong>Section:</strong> {book.section}</p>}
              {book.description && (
                <p className="desc">{book.description}</p>
              )}
            </div>

            {/* PDF READER */}
            <div className="reader">
              <Document
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(e) => console.error("PDF error:", e)}
                renderMode="canvas"
                options={pdfOptions}
              >
                <Page
                  key={`page-${pageNumber}`}
                  pageNumber={pageNumber}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />

                {/* Preload the next couple pages off-screen so pdf.js has
                    already fetched/parsed them by the time the user clicks
                    Next — makes navigation feel instant. */}
                {numPages && pageNumber + 1 <= numPages && (
                  <div className="preload" aria-hidden="true">
                    <Page
                      key={`preload-${pageNumber + 1}`}
                      pageNumber={pageNumber + 1}
                      width={pageWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                  </div>
                )}
                {numPages && pageNumber + 2 <= numPages && (
                  <div className="preload" aria-hidden="true">
                    <Page
                      key={`preload-${pageNumber + 2}`}
                      pageNumber={pageNumber + 2}
                      width={pageWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                  </div>
                )}
              </Document>
            </div>

            {/* PAGINATION */}
            {numPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
                  disabled={pageNumber === 1}
                >
                  ◀ Prev
                </button>

                <div className="page-jump">
                  <span>Page</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={numPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={handlePageInputKeyDown}
                    onBlur={goToPage}
                    aria-label="Go to page"
                  />
                  <span>/ {numPages}</span>
                </div>

                <button
                  onClick={() =>
                    setPageNumber((p) => Math.min(p + 1, numPages))
                  }
                  disabled={pageNumber === numPages}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />

      {/* ================= STYLE ================= */}
      <style jsx>{`
        .page {
          padding: 80px 16px 100px;
          background: #f9fbe7;
          min-height: 100vh;
          font-family: "Poppins", sans-serif;
        }

        @media (max-width: 768px) {
          .page {
            margin-left: 0;
          }
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
        }

        .ebook-card {
          background: #fff;
          padding: 16px;
          border-radius: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .cover {
          width: 120px;
          display: block;
          margin: 0 auto 10px;
          border-radius: 10px;
        }

        .info {
          text-align: center;
          margin-bottom: 12px;
        }

        h2 {
          color: #2e7d32;
          font-size: 1.2rem;
          margin-bottom: 6px;
        }

        p {
          font-size: 0.85rem;
          color: #444;
          margin: 2px 0;
        }

        .desc {
          margin-top: 6px;
          font-size: 0.8rem;
        }

        .reader {
          display: flex;
          justify-content: center;
          margin-top: 10px;
          position: relative;
        }

        canvas {
          border-radius: 8px;
        }

        .preload {
          position: absolute;
          top: 0;
          left: -99999px;
          width: 0;
          height: 0;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
        }

        .pagination button {
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          background: #2e7d32;
          color: white;
          cursor: pointer;
        }

        .pagination button:disabled {
          background: #ccc;
        }

        .page-jump {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          color: #444;
        }

        .page-jump input {
          width: 52px;
          text-align: center;
          padding: 4px 6px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 0.85rem;
        }

        .page-jump input:focus {
          outline: none;
          border-color: #2e7d32;
        }

        .loading {
          padding: 80px;
          text-align: center;
          color: #666;
        }
      `}</style>
    </>
  );
}