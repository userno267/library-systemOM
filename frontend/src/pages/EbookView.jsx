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

  const token = localStorage.getItem("token");
  const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  const pdfOptions = useMemo(
    () => ({ cMapUrl: "cmaps/", cMapPacked: true }),
    []
  );

  useEffect(() => {
    fetchBook();
  }, [id]);

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
                file={{
                  url: pdfUrl,
                  httpHeaders: {
                    Authorization: `Bearer ${token}`,
                    "ngrok-skip-browser-warning": "true",
                  },
                  withCredentials: false,
                }}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(e) => console.error("PDF error:", e)}
                renderMode="canvas"
                options={pdfOptions}
              >
                <Page
                  pageNumber={pageNumber}
                  width={Math.min(window.innerWidth - 32, 900)}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
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

                <span>
                  Page {pageNumber} / {numPages}
                </span>

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
        }

        canvas {
          border-radius: 8px;
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

        .loading {
          padding: 80px;
          text-align: center;
          color: #666;
        }
      `}</style>
    </>
  );
}