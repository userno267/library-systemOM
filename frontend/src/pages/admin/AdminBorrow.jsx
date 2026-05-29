// src/pages/admin/AdminBorrow.jsx
import { useEffect, useState, useRef } from "react";
import Select from "react-select";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminBorrow() {
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [activeBorrows, setActiveBorrows] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const baseURL = import.meta.env.VITE_API_URL;

  const headers = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true",
  };

  const abortRef = useRef(null);

  /* ================= USERS ================= */
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${baseURL}/api/users?page=1&limit=1000`, { headers });
      const data = await res.json();

      setUsers(
        (data.users || []).map((u) => ({
          value: u.id,
          label: `${u.full_name}${u.lrn ? ` (LRN: ${u.lrn})` : ""}`,
        }))
      );
    } catch {
      setUsers([]);
    }
  };

  /* ================= BOOKS ================= */
  const fetchBooks = async () => {
    try {
      const res = await fetch(`${baseURL}/api/books?page=1&limit=1000`, { headers });
      const data = await res.json();

      setBooks(
        (data.books || []).map((b) => ({
          value: b.id,
          label: b.title,
        }))
      );
    } catch {
      setBooks([]);
    }
  };

  /* ================= BORROWS ================= */
  const fetchBorrows = async (pageNum = 1, searchText = "") => {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const res = await fetch(
        `${baseURL}/api/admin/active?page=${pageNum}&limit=10&search=${searchText}`,
        { headers, signal: abortRef.current.signal }
      );

      const data = await res.json();

      setActiveBorrows(data.borrows || []);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBooks();
    fetchBorrows(1, "");
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchBorrows(page, debouncedSearch);
  }, [page, debouncedSearch]);

  /* ================= BORROW ================= */
  const handleBorrow = async () => {
    if (!selectedUser || !selectedBook) return alert("Select user and book");

    try {
      setLoading(true);

      const res = await fetch(`${baseURL}/api/admin/borrow`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.value,
          book_id: selectedBook.value,
        }),
      });

      if (!res.ok) throw new Error();

      alert("Borrow successful");
      setSelectedUser(null);
      setSelectedBook(null);
      fetchBorrows(page, debouncedSearch);
    } catch {
      alert("Borrow failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RETURN ================= */
  const handleReturn = async (id) => {
    if (!confirm("Return this book?")) return;

    try {
      const res = await fetch(`${baseURL}/api/admin/return`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ borrow_id: id }),
      });

      if (!res.ok) throw new Error();

      alert("Book returned");
      fetchBorrows(page, debouncedSearch);
    } catch {
      alert("Return failed");
    }
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <h1 className="page-title">📚 Borrow Management</h1>

        {/* CONTROLS */}
        <div className="card controls">
          <Select
            options={users}
            value={selectedUser}
            onChange={setSelectedUser}
            placeholder="Search user..."
            isClearable
          />

          <Select
            options={books}
            value={selectedBook}
            onChange={setSelectedBook}
            placeholder="Search book..."
            isClearable
          />

          <button onClick={handleBorrow} disabled={loading}>
            {loading ? "Processing..." : "➕ Borrow"}
          </button>
        </div>

        {/* SEARCH */}
        <div className="card">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔎 Search active borrows..."
          />
        </div>

        {/* TABLE */}
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Book</th>
                <th>Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {activeBorrows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty">No data</td>
                </tr>
              ) : (
                activeBorrows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.full_name}</td>
                    <td>{b.title}</td>
                    <td>{new Date(b.due_date).toLocaleDateString()}</td>
                    <td><span className="badge">ACTIVE</span></td>
                    <td>
                      <button className="danger" onClick={() => handleReturn(b.id)}>
                        Return
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .page-title {
          color: #2e7d32;
          margin-bottom: 20px;
        }

        .card {
          background: white;
          border: 1px solid #c5e1a5;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .controls {
          display: flex;
          gap: 10px;
        }

        input {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #c5e1a5;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          background: #e8f5e9;
          padding: 12px;
          text-align: left;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #eee;
        }

        tr:hover {
          background: #f1f8e9;
        }

        .badge {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 4px 10px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 12px;
        }

        button {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 10px 14px;
          border-radius: 10px;
          cursor: pointer;
        }

        button:hover {
          background: #1b5e20;
        }

        .danger {
          background: #d32f2f;
        }

        .danger:hover {
          background: #b71c1c;
        }

        .pagination {
          display: flex;
          justify-content: space-between;
          margin-top: 15px;
        }

        .empty {
          text-align: center;
          padding: 20px;
          color: #777;
        }
      `}</style>
    </>
  );
}