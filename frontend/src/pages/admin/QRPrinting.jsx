import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AdminSidebar from "../../components/AdminSidebar";

export default function QRPrintDashboard() {
  const [books, setBooks] = useState([]);
  const [selectedBooks, setSelectedBooks] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [previewPDF, setPreviewPDF] = useState(null);
  const [isPDFReady, setIsPDFReady] = useState(false);

  const iframeRef = useRef(null);

  const token = localStorage.getItem("token");
  const baseURL = import.meta.env.VITE_API_URL;

  const apiHeaders = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true",
  };

  /* =========================
     FETCH BOOKS
  ========================= */
  useEffect(() => {
    fetchBooks();
  }, [page, search]);

  const fetchBooks = async () => {
    try {
      const res = await axios.get(`${baseURL}/api/books`, {
        headers: apiHeaders,
        params: { page, limit: 12, search },
      });
      setBooks(res.data.books);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
    }
  };

  /* =========================
     AUTO GENERATE PDF
  ========================= */
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (Object.keys(selectedBooks).length > 0) {
        generatePreview();
      } else {
        setPreviewPDF(null);
        setIsPDFReady(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [selectedBooks]);

  /* =========================
     CTRL + P OVERRIDE
  ========================= */
useEffect(() => {
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();

      if (!previewPDF || !iframeRef.current) return;

      if (!isPDFReady) {
        alert("PDF still loading, please wait...");
        return;
      }

      try {
        const iframe = iframeRef.current;

        // 🔥 FORCE PDF CONTEXT BACK TO ACTIVE
        iframe.focus();

        // IMPORTANT: re-assign src if needed (prevents stale DOM fallback)
        if (iframe.src !== previewPDF) {
          iframe.src = previewPDF;
          return;
        }

        // extra safety delay for Chrome PDF engine
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 150);

      } catch (err) {
        console.error("Printing failed", err);
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [previewPDF, isPDFReady]);

  /* =========================
     SELECT BOOKS
  ========================= */
  const toggleSelectBook = (bookId) => {
    setSelectedBooks((prev) => {
      if (prev[bookId]) {
        const { [bookId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [bookId]: 1 };
    });
  };

  const handleCopyChange = (bookId, value) => {
    setSelectedBooks((prev) => ({
      ...prev,
      [bookId]: Math.max(1, Number(value)),
    }));
  };

  /* =========================
     GENERATE PDF
  ========================= */
  const generatePreview = async () => {
    if (!Object.keys(selectedBooks).length) return;

    setLoading(true);
    setIsPDFReady(false);

    try {
      const payload = Object.entries(selectedBooks).map(
        ([bookId, copies]) => ({
          bookId: Number(bookId),
          copiesToPrint: copies,
        })
      );

      const res = await axios.post(
        `${baseURL}/api/books/print-qrcodes`,
        { books: payload },
        {
          headers: apiHeaders,
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreviewPDF(url);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  /* =========================
     PRINT INLINE
  ========================= */
 const handlePrintPDF = () => {
  if (!previewPDF || !iframeRef.current) return;

  // Force reload of iframe
  iframeRef.current.src = previewPDF;

  // Wait for iframe to load, then mark as ready but do NOT auto-print
  iframeRef.current.onload = () => {
    setIsPDFReady(true);
     try {
    iframeRef.current?.contentWindow?.focus();
  } catch (e) {}

    try {
      // Only focus, don't auto-print
      iframeRef.current.contentWindow.focus();
    } catch (err) {
      console.error("Iframe focus failed", err);
    }
  };
};
  /* =========================
     UI
  ========================= */
  return (
    <>
      <AdminSidebar />
      <div className="admin-main">
        <h1>QR Sticker Printing</h1>

        <input
          type="text"
          placeholder="Search by title or author..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ marginBottom: 20, padding: 8, width: "50%" }}
        />

        <div className="book-list">
          {books.map((book) => {
            const isSelected = selectedBooks[book.id];
            const coverURL = book.cover_image
              ? `${baseURL}${book.cover_image}`
              : "/placeholder.png";

            return (
              <div
                key={book.id}
                className={`book-item ${isSelected ? "selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={!!isSelected}
                  onChange={() => toggleSelectBook(book.id)}
                />
                <img src={coverURL} alt={book.title} />
                <div className="book-info">
                  <strong>{book.title}</strong>
                  {book.volume && <span>Vol. {book.volume}</span>}
                  <span>Call No: {book.call_number || "-"}</span>
                  {isSelected && (
                    <input
                      type="number"
                      min="1"
                      value={selectedBooks[book.id]}
                      onChange={(e) =>
                        handleCopyChange(book.id, e.target.value)
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span style={{ margin: "0 10px" }}>
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>

        {previewPDF && (
          <>
            {loading && <p>Loading PDF preview...</p>}

            <iframe
              ref={iframeRef}
              src={previewPDF}
              onLoad={() => setIsPDFReady(true)}
              style={{
                width: "100%",
                height: "500px",
                marginTop: 20,
                border: "1px solid #ccc",
              }}
            />

            <button
              onClick={handlePrintPDF}
              disabled={!isPDFReady}
              style={{ marginTop: 10 }}
            >
              🖨️ {isPDFReady ? "Print QR Codes" : "Loading PDF..."}
            </button>
          </>
        )}
      </div>

      <style>{`
        .admin-main { margin-left: 260px; padding: 30px; background: #f9fbe7; min-height: 100vh; }
        .book-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .book-item { background: white; border-radius: 10px; padding: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; flex-direction: column; align-items: center; }
        .book-item.selected { border: 2px solid #1976d2; }
        .book-item img { width: 100px; height: 140px; object-fit: cover; margin-bottom: 10px; }
        .book-info { text-align: center; display: flex; flex-direction: column; gap: 4px; }
        .book-info input { width: 60px; margin-top: 5px; }
        button { background: #1976d2; color: white; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; }
        button:disabled { background: gray; }
      `}</style>
    </>
  );
}