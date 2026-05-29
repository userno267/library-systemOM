import { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function BrowseBooks() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const limit = 10;
  const token = localStorage.getItem("token");

  /* ===========================
     FETCH BOOKS
  =========================== */
const fetchBooks = useCallback(async () => {
  try {
    setLoading(true);

    const params = new URLSearchParams({
      page,
      limit,
      search,
      type: "physical", // ✅ Only physical books
    });

    const url = `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api/books/physical?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "anyvalue",
      },
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("FETCH BOOKS NON-OK RESPONSE:", text);
      throw new Error(`Failed to fetch books: ${res.status}`);
    }

    const data = JSON.parse(text);
    setBooks(data.books || []);
    setTotalPages(data.totalPages || 1);

  } catch (err) {
    console.error("FETCH BOOKS ERROR:", err);
  } finally {
    setLoading(false);
  }
}, [page, search, token]);

  /* ===========================
     INITIAL + FILTER FETCH
  =========================== */
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  /* ===========================
     SOCKET LIVE UPDATES
  =========================== */
  useEffect(() => {
    socket.on("booksUpdated", () => {
      fetchBooks();
    });

    return () => {
      socket.off("booksUpdated");
    };
  }, [fetchBooks]);

  return (
    <>
      <Sidebar />

      <div className="main">
        <h1>📚 Browse Books</h1>

        {/* Search */}
        <div className="filters">
          <input
            type="text"
            placeholder="Search title or author..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        {/* Content */}
        {loading && <p className="center">Loading books...</p>}

        {!loading && books.length === 0 && (
          <p className="center">No books found.</p>
        )}

        <div className="book-grid">
          {books.map((book) => {
      const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, "");

let coverUrl = "/placeholder-book.png";

if (book.cover_image) {
  const cleanedPath = book.cover_image.startsWith("/")
    ? book.cover_image
    : `/${book.cover_image}`;

  coverUrl = `${baseUrl}${cleanedPath}`;
}


            return (
              <div key={book.id} className="book-card">
                <img src={coverUrl} alt={book.title} />
                <h3>{book.title}</h3>
                <p>by {book.author}</p>

               <div className="meta">
  <span>{book.type}</span>
  <span> and </span>
  <span>{book.status}</span>
</div>

                <button onClick={() => navigate(`/books/${book.id}`)}>
                  View
                </button>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ◀
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      <BottomNav />

      <style jsx>{`
      
        .main {
          padding: 80px 16px 100px;
          background: #f9fbe7;
          min-height: 100vh;
          font-family: "Poppins", sans-serif;
        }

        h1 {
          text-align: center;
          color: #2e7d32;
          margin-bottom: 15px;
        }

        .filters {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        input,
        select {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #8d6e63;
          background: #fff8e1;
          font-weight: 500;
        }

        .center {
          text-align: center;
          color: #777;
        }

        .book-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }

        .book-card {
          background: #fff;
          border-radius: 12px;
          padding: 10px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .book-card img {
          width: 100%;
          height: 160px;
          object-fit: cover;
          border-radius: 10px;
        }

        .book-card h3 {
          font-size: 0.9rem;
          margin: 6px 0 2px;
          color: #1b5e20;
        }

        .book-card p {
          font-size: 0.8rem;
          color: #4e342e;
        }

        .book-card span {
          font-size: 0.75rem;
          color: #827717;
        }

        .book-card button {
          width: 100%;
          margin-top: 6px;
          padding: 6px;
          border: none;
          border-radius: 8px;
          background: #2e7d32;
          color: #fff;
          font-weight: 600;
        }

        .pagination {
          margin-top: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
        }

        .pagination button {
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          background: #2e7d32;
          color: white;
          font-weight: bold;
        }

        .pagination button:disabled {
          opacity: 0.4;
        }
      `}</style>
    </>
  );
}
