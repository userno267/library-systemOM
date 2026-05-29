// src/pages/admin/BorrowManagement.jsx

import { useEffect, useState, useRef } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import Select from "react-select";
import socket from "../../socket";

export default function ActiveBorrowManagement() {
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const baseURL = import.meta.env.VITE_API_URL;

  const abortRef = useRef(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true",
  };

  /* ================= USERS ================= */
  const fetchUsers = async () => {
    const res = await fetch(`${baseURL}/api/users?page=1&limit=1000`, { headers });
    const data = await res.json();

    setUsers(
      (data.users || []).map((u) => ({
        value: u.id,
        label: `${u.full_name}${u.lrn ? ` (LRN: ${u.lrn})` : ""}`,
      }))
    );
  };

  /* ================= BOOKS ================= */
  const fetchBooks = async () => {
    const res = await fetch(`${baseURL}/api/books?page=1&limit=1000`, { headers });
    const data = await res.json();

    setBooks(
      (data.books || []).map((b) => ({
        value: b.id,
        label: b.title,
      }))
    );
  };

  /* ================= BORROWS ================= */
  const fetchBorrows = async (pageNum = 1, searchText = "") => {
    try {
      setLoading(true);

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const params = new URLSearchParams({
        page: pageNum,
        limit: 10,
        search: searchText,
        status: filter === "all" ? "" : filter,
      });

      const res = await fetch(
        `${baseURL}/api/admin/active?${params.toString()}`,
        {
          headers,
          signal: abortRef.current.signal,
        }
      );

      const data = await res.json();

      setBorrows(data.borrows || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
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
  }, [page, debouncedSearch, filter]);

  useEffect(() => {
    if (!token) return;

    if (!socket.connected) socket.connect();
    socket.auth = { token };
    socket.emit("join", "admins");

    socket.on("borrowUpdate", () => {
      fetchBorrows(page, debouncedSearch);
    });

    return () => socket.off("borrowUpdate");
  }, [page, debouncedSearch]);

  /* ================= ACTIONS ================= */
  const handleBorrow = async () => {
    if (!selectedUser || !selectedBook) return alert("Select user and book");

    await fetch(`${baseURL}/api/admin/borrow`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: selectedUser.value,
        book_id: selectedBook.value,
      }),
    });

    setSelectedUser(null);
    setSelectedBook(null);
    fetchBorrows(page, debouncedSearch);
  };

  const approveBorrow = async (id) => {
    await fetch(`${baseURL}/api/admin/approve-borrow`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: id }),
    });
    fetchBorrows(page, debouncedSearch);
  };

  const approveReturn = async (id) => {
    await fetch(`${baseURL}/api/admin/approve-return`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: id }),
    });
    fetchBorrows(page, debouncedSearch);
  };

  const rejectRequest = async (id) => {
    await fetch(`${baseURL}/api/borrows/admin/reject`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: id }),
    });
    fetchBorrows(page, debouncedSearch);
  };

  const statusClass = (status) => {
    switch (status) {
      case "pending_borrow":
        return "badge yellow";
      case "borrowed":
        return "badge blue";
      case "pending_return":
        return "badge orange";
      case "returned":
        return "badge green";
      default:
        return "badge";
    }
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <h1>Borrow Management</h1>

        {/* CREATE */}
        <div className="card">
          <h3>Create Borrow</h3>

          <div className="row">
            <Select options={users} value={selectedUser} onChange={setSelectedUser} placeholder="User" />
            <Select options={books} value={selectedBook} onChange={setSelectedBook} placeholder="Book" />
<button
  className="primary-btn"
  onClick={handleBorrow}
  disabled={!selectedUser || !selectedBook}
>
  ➕ Borrow
</button>          </div>
        </div>

        {/* SEARCH + FILTER TOOLBAR */}
        <div className="toolbar">
          <div className="search-box">
            <span>🔍</span>
            <input
              placeholder="Search user or book..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch("")}>✕</button>}
          </div>

          <div className="filters">
            {["all", "pending_borrow", "borrowed", "pending_return", "returned"].map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="card">
          {loading ? (
            <p>Loading...</p>
          ) : borrows.length === 0 ? (
            <p>No records found</p>
          ) : (
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
                {borrows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.full_name}</td>
                    <td>{b.title}</td>
                    <td>{b.due_date ? new Date(b.due_date).toLocaleDateString() : "—"}</td>
                    <td>
                      <span className={statusClass(b.status)}>{b.status}</span>
                    </td>

                    <td className="actions">
                      {b.status === "pending_borrow" && (
                        <>
                          <button onClick={() => approveBorrow(b.id)}>✔</button>
                          <button className="danger" onClick={() => rejectRequest(b.id)}>✖</button>
                        </>
                      )}

                      {b.status === "pending_return" && (
                        <>
                          <button onClick={() => approveReturn(b.id)}>✔</button>
                          <button className="danger" onClick={() => rejectRequest(b.id)}>✖</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>◀</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
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

        .card {
          background: white;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .search-box {
          display: flex;
          align-items: center;
          background: white;
          border-radius: 8px;
          padding: 6px 10px;
          flex: 1;
          border: 1px solid #ddd;
        }

        .search-box input {
          border: none;
          outline: none;
          flex: 1;
        }

        .filters button {
          padding: 6px 10px;
          border-radius: 6px;
          border: none;
          background: #eee;
        }

        .filters .active {
          background: #2e7d32;
          color: white;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        tbody tr:hover {
          background: #f5f5f5;
        }

        td, th {
          padding: 10px;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
        }

        .green { background: #c8e6c9; }
        .yellow { background: #fff9c4; }
        .blue { background: #bbdefb; }
        .orange { background: #ffe0b2; }

        .actions button {
          border: none;
          padding: 5px 8px;
          border-radius: 6px;
          background: #2e7d32;
          color: white;
        }

        .danger {
          background: #c62828;
        }

        .pagination {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 12px;
        }

        .primary-btn {
  background: linear-gradient(135deg, #ee0808, #2e7d32);
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(46, 125, 50, 0.3);
}

.primary-btn:active {
  transform: scale(0.97);
  box-shadow: none;
}

.primary-btn:disabled {
  background: #c8e6c9;
  cursor: not-allowed;
  box-shadow: none;
}
      `}</style>
    </>
  );
}