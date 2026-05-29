import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { useNavigate } from "react-router-dom";
import socket from "../../socket";

export default function BookManagement() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState([]);

  const navigate = useNavigate();
  const limit = 10;
  const token = localStorage.getItem("token");

  const fetchBooks = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page,
        limit,
        search,
        status: filter === "all" ? "" : filter,
      });

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/books?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "anyvalue",
          },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch books");

      const data = await res.json();
      setBooks(data.books || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Error loading books:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [page, search, filter]);

  useEffect(() => {
    if (!token) return;

    if (!socket.connected) socket.connect();
    socket.auth = { token };
    socket.emit("join", "admins");

    const handleBorrowUpdate = () => fetchBooks();

    socket.on("borrowUpdate", handleBorrowUpdate);

    return () => socket.off("borrowUpdate", handleBorrowUpdate);
  }, [token]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this book?")) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/books/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Delete failed");

      setSelected((prev) => prev.filter((x) => x !== id));
      fetchBooks();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const pageIds = books.map((b) => b.id);

    const allSelected =
      pageIds.length > 0 &&
      pageIds.every((id) => selected.includes(id));

    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return alert("No books selected");
    if (!confirm(`Delete ${selected.length} books?`)) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/books/bulk-delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids: selected }),
        }
      );

      if (!res.ok) throw new Error("Bulk delete failed");

      setSelected([]);
      fetchBooks();
    } catch (err) {
      console.error(err);
      alert("Bulk delete failed");
    }
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <div className="header">
          <div>
            <h1>Book Management</h1>
            <p>Manage your library inventory</p>
          </div>

          <div>
            <button className="add-btn" onClick={() => navigate("/admin/add-book")}>
              ➕ Add Book
            </button>
          </div>
        </div>

        <div className="controls">
          <input
            placeholder="🔍 Search by title or author"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />

          <select
            value={filter}
            onChange={(e) => {
              setPage(1);
              setFilter(e.target.value);
            }}
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>

        {/* ================= REDESIGNED BULK BAR ================= */}
        {selected.length > 0 && (
          <div className="bulk-float-bar">
            <div className="bulk-left">
              <span className="bulk-count">
                {selected.length} selected
              </span>
              <span className="bulk-hint">Bulk actions</span>
            </div>

            <div className="bulk-actions">
              <button className="bulk-delete" onClick={handleBulkDelete}>
                🗑 Delete
              </button>

              <button className="bulk-clear" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="center">Loading books...</p>
        ) : books.length === 0 ? (
          <p className="center">No books found.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        books.length > 0 &&
                        books.every((b) => selected.includes(b.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>

                  <th>ID</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Type</th>
                  <th>Section</th>
                  <th>Copies</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {books.map((book) => (
                  <tr key={book.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(book.id)}
                        onChange={() => toggleSelect(book.id)}
                      />
                    </td>

                    <td>{book.id}</td>
                    <td><strong>{book.title}</strong></td>
                    <td>{book.author}</td>
                    <td>{book.type}</td>
                    <td>{book.section || "—"}</td>
                    <td>{book.type === "digital" ? "—" : book.copies}</td>
                    <td>{book.status}</td>
                    <td>{new Date(book.created_at).toLocaleDateString()}</td>

                    <td className="actions">
                      <button className="edit" onClick={() => navigate(`/admin/edit-book/${book.id}`)}>
                        Edit
                      </button>

                      <button onClick={() => navigate(`/admin/books/${book.id}`)}>
                        👁 View
                      </button>

                      <button className="delete" onClick={() => handleDelete(book.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>◀</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>▶</button>
            </div>
          </>
        )}
      </div>

      <style >{`
     .admin-main { margin-left: 260px; padding: 30px; background: #f9fbe7; min-height: 100vh; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .controls { display: flex; gap: 10px; margin: 20px 0; }
        input, select { padding: 10px; border-radius: 8px; border: 1px solid #ccc; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; }
        th, td { padding: 12px; border-bottom: 1px solid #ddd; vertical-align: top; }
        th { background: #c5e1a5; color: #1b5e20; }
        .desc { font-size: 0.8rem; color: #555; margin-top: 4px; }
        .type { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize; }
        .type.physical { background: #c8e6c9; color: #1b5e20; }
        .type.digital { background: #bbdefb; color: #0d47a1; }
        .status { font-weight: bold; text-transform: capitalize; }
        .status.available { color: #2e7d32; }
        .status.unavailable { color: #c62828; }
        .actions { display: flex; gap: 6px; align-items: center; }
        .icon-btn { width: 34px; height: 34px; border-radius: 8px; border: none; font-size: 1rem; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .icon-btn.preview { background: #e3f2fd; color: #0d47a1; }
        .edit { background: #43a047; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 600; }
        .delete { background: #e53935; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 600; }
        .add-btn { background: #2e7d32; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; }
        .pagination { margin-top: 20px; display: flex; justify-content: center; align-items: center; gap: 15px; }
        .pagination button { padding: 6px 12px; border-radius: 8px; border: none; background: #2e7d32; color: white; font-weight: bold; }
        .pagination button:disabled { opacity: 0.4; }
        button:hover { opacity: 0.85; transform: scale(1.05); cursor: pointer; }
        .center { text-align: center; color: #777; }
        .borrow-btn {
  background: #1565c0;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: bold;
  margin-left: 10px;
}
        /* ================= BULK FLOAT BAR (REDESIGNED) ================= */
        .bulk-float-bar {
          position: sticky;
          bottom: 20px;
          margin-top: 20px;
          background: #1b5e20;
          color: white;
          padding: 12px 16px;
          border-radius: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }

        .bulk-left {
          display: flex;
          flex-direction: column;
        }

        .bulk-count {
          font-weight: 700;
        }

        .bulk-hint {
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .bulk-actions {
          display: flex;
          gap: 10px;
        }

        .bulk-delete {
          background: #e53935;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          color: white;
          font-weight: 600;
        }

        .bulk-clear {
          background: transparent;
          border: 1px solid white;
          padding: 8px 14px;
          border-radius: 8px;
          color: white;
        }

        button:hover {
          opacity: 0.9;
          cursor: pointer;
        }
      `}</style>
    </>
  );
}