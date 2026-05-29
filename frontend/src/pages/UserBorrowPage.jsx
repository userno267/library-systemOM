import { useEffect, useState, useContext, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

export default function UserBorrowPage() {
  const { token } = useContext(AuthContext);

  const [borrows, setBorrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const limit = 4;

  const baseURL = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  /* ===========================
     FETCH BORROWS
  =========================== */
  const fetchBorrows = async () => {
    try {
      const res = await fetch(`${baseURL}/api/borrows/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch borrows");

      const data = await res.json();
      setBorrows(data);
    } catch (err) {
      console.error("BORROW FETCH ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchBorrows();
  }, [token]);

  /* ===========================
     RETURN BOOK
  =========================== */
  const handleReturn = async (book_id) => {
    if (!window.confirm("Return this book?")) return;

    try {
      const res = await fetch(`${baseURL}/api/return`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ book_id }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Return failed");
        return;
      }

      fetchBorrows();
    } catch (err) {
      console.error("RETURN ERROR:", err);
    }
  };

  /* ===========================
     FILTER + SPLIT DATA
  =========================== */
  const filtered = useMemo(() => {
    return borrows.filter((b) =>
      b.title?.toLowerCase().includes(search.toLowerCase())
    );
  }, [borrows, search]);

  const currentBorrows = filtered.filter((b) => !b.returned_at);
  const historyBorrows = filtered.filter((b) => b.returned_at);

  /* ===========================
     PAGINATION LOGIC
  =========================== */
  const paginate = (data, page) => {
    const start = (page - 1) * limit;
    return data.slice(start, start + limit);
  };

  const paginatedCurrent = paginate(currentBorrows, currentPage);
  const paginatedHistory = paginate(historyBorrows, historyPage);

  const currentTotalPages = Math.ceil(currentBorrows.length / limit);
  const historyTotalPages = Math.ceil(historyBorrows.length / limit);

  if (loading)
    return <p style={{ textAlign: "center", marginTop: "100px" }}>Loading...</p>;

  return (
    <>
      <Sidebar />

      <div className="main">
        <h1>📚 My Borrowed Books</h1>

        {/* SEARCH */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by book title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
              setHistoryPage(1);
            }}
          />
        </div>

        {/* CURRENTLY BORROWED */}
        <section>
          <h2>Currently Borrowed</h2>

          {paginatedCurrent.length === 0 && (
            <p className="center">No active borrows.</p>
          )}

          <div className="book-grid">
            {paginatedCurrent.map((b) => {
              const coverUrl = b.cover_image
                ? `${baseURL}${b.cover_image.startsWith("/") ? "" : "/"}${b.cover_image}`
                : "/placeholder-book.png";

              return (
                <div key={b.id} className="book-card">
                  <img src={coverUrl} alt={b.title} />
                  <h3>{b.title}</h3>
                  <p>Due: {new Date(b.due_date).toLocaleDateString()}</p>
                  <button onClick={() => handleReturn(b.book_id)}>
                    Return Book
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {currentTotalPages > 1 && (
            <div className="pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                ◀
              </button>
              <span>
                Page {currentPage} of {currentTotalPages}
              </span>
              <button
                disabled={currentPage === currentTotalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                ▶
              </button>
            </div>
          )}
        </section>

        {/* HISTORY */}
        <section>
          <h2>Borrow History</h2>

          {paginatedHistory.length === 0 && (
            <p className="center">No borrow history found.</p>
          )}

          <div className="book-grid">
            {paginatedHistory.map((b) => {
              const coverUrl = b.cover_image
                ? `${baseURL}${b.cover_image.startsWith("/") ? "" : "/"}${b.cover_image}`
                : "/placeholder-book.png";

              return (
                <div key={b.id} className="book-card history">
                  <img src={coverUrl} alt={b.title} />
                  <h3>{b.title}</h3>
                  <p>
                    Borrowed:{" "}
                    {new Date(b.borrowed_at).toLocaleDateString()}
                  </p>
                  <p>
                    Returned:{" "}
                    {new Date(b.returned_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>

          {historyTotalPages > 1 && (
            <div className="pagination">
              <button
                disabled={historyPage === 1}
                onClick={() => setHistoryPage((p) => p - 1)}
              >
                ◀
              </button>
              <span>
                Page {historyPage} of {historyTotalPages}
              </span>
              <button
                disabled={historyPage === historyTotalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                ▶
              </button>
            </div>
          )}
        </section>
      </div>

      <BottomNav />

      <style jsx>{`
        .main {
          padding: 80px 16px 100px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        h1 {
          text-align: center;
          color: #2e7d32;
          margin-bottom: 15px;
        }

        h2 {
          margin-top: 30px;
          color: #1b5e20;
        }

        .search-box {
          margin-bottom: 15px;
        }

        .search-box input {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
        }

        .book-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-top: 10px;
        }

        .book-card {
          background: #fff;
          border-radius: 12px;
          padding: 10px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
        }

        .book-card img {
          width: 100%;
          height: 150px;
          object-fit: cover;
          border-radius: 10px;
        }

        .book-card button {
          width: 100%;
          padding: 6px;
          border-radius: 8px;
          border: none;
          background: #c62828;
          color: white;
          font-weight: bold;
          margin-top: 6px;
        }

        .history {
          opacity: 0.8;
        }

        .pagination {
          margin-top: 10px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
        }

        .pagination button {
          padding: 6px 10px;
          border-radius: 8px;
          border: none;
          background: #2e7d32;
          color: white;
        }

        .pagination button:disabled {
          opacity: 0.4;
        }

        .center {
          text-align: center;
          color: #777;
        }
      `}</style>
    </>
  );
}