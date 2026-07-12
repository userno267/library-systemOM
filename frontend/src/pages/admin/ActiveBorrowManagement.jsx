// src/pages/admin/ActiveBorrowManagement.jsx

import { useEffect, useState, useRef } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import Select from "react-select";
import socket from "../../socket";

const customSelectStyle = {
  control: (base) => ({
    ...base,
    borderRadius: "8px",
    borderColor: "#ddd",
    fontSize: "0.9rem",
    minHeight: "40px"
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "#2e7d32" : state.isFocused ? "#e8f5e9" : "white",
    color: state.isSelected ? "white" : "#333"
  })
};

export default function ActiveBorrowManagement() {
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [showBorrowForm, setShowBorrowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [stats, setStats] = useState({});
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

  /* ═══════════════════════════════════════
     FETCH STATS
  ═══════════════════════════════════════ */
  const fetchStats = async () => {
    try {
      const allRes = await fetch(
        `${baseURL}/api/admin/active?page=1&limit=10000`,
        { headers }
      );
      const allData = allRes.json();
      
      allData.then(data => {
        const borrowList = data.borrows || [];
        const pending = borrowList.filter(b => b.status === "pending_borrow").length;
        const active = borrowList.filter(b => b.status === "borrowed").length;
        const pendingReturn = borrowList.filter(b => b.status === "pending_return").length;

        setStats({
          pending,
          active,
          pendingReturn,
          total: borrowList.length
        });
      });
    } catch (err) {
      console.error("Stats error:", err);
    }
  };

  /* ═══════════════════════════════════════
     FETCH USERS
  ═══════════════════════════════════════ */
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
    } catch (err) {
      console.error("Users fetch error:", err);
    }
  };

  /* ═══════════════════════════════════════
     FETCH BOOKS
  ═══════════════════════════════════════ */
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
    } catch (err) {
      console.error("Books fetch error:", err);
    }
  };

  /* ═══════════════════════════════════════
     FETCH BORROWS
  ═══════════════════════════════════════ */
  const fetchBorrows = async (pageNum = 1, searchText = "") => {
    try {
      setLoading(true);

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const params = new URLSearchParams({
        page: pageNum,
        limit: 15,
        search: searchText,
        status: filter === "all" ? "" : filter,
      });

      const res = await fetch(
        `${baseURL}/api/admin/active?${params.toString()}`,
        { headers, signal: abortRef.current.signal }
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

  /* ═══════════════════════════════════════
     ACTIONS
  ═══════════════════════════════════════ */
  const handleBorrow = async () => {
    if (!selectedUser || !selectedBook) {
      alert("Please select both student and book");
      return;
    }

    try {
      const res = await fetch(`${baseURL}/api/admin/borrow`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.value,
          book_id: selectedBook.value,
        }),
      });

      if (res.ok) {
        setSelectedUser(null);
        setSelectedBook(null);
        setShowBorrowForm(false);
        fetchStats();
        fetchBorrows(page, debouncedSearch);
      } else {
        alert("Failed to create borrow request");
      }
    } catch (err) {
      console.error("Borrow error:", err);
      alert("Error creating borrow");
    }
  };

  const approveBorrow = async (id) => {
    await fetch(`${baseURL}/api/admin/approve-borrow`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: id }),
    });
    fetchStats();
    fetchBorrows(page, debouncedSearch);
  };

  const approveReturn = async (id) => {
    await fetch(`${baseURL}/api/admin/approve-return`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: id }),
    });
    fetchStats();
    fetchBorrows(page, debouncedSearch);
  };

  const directReturn = async (id) => {
    if (!confirm("Process return directly?")) return;

    const res = await fetch(`${baseURL}/api/admin/return`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: id }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.message || "Return failed");
      return;
    }

    fetchStats();
    fetchBorrows(page, debouncedSearch);
  };

  const rejectRequest = async (id) => {
    if (!confirm("Reject this request?")) return;

    await fetch(`${baseURL}/api/borrows/admin/reject`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: id }),
    });

    fetchStats();
    fetchBorrows(page, debouncedSearch);
  };

  /* ═══════════════════════════════════════
     EFFECTS
  ═══════════════════════════════════════ */
  useEffect(() => {
    fetchUsers();
    fetchBooks();
    fetchStats();
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
      fetchStats();
      fetchBorrows(page, debouncedSearch);
    });
    return () => socket.off("borrowUpdate");
  }, [page, debouncedSearch]);

  const formatDueDate = (due) => {
    if (!due) return "—";
    const d = new Date(due);
    const today = new Date();
    const isOverdue = d < today;
    return (
      <span className={isOverdue ? "overdue" : ""}>
        {d.toLocaleDateString()}
      </span>
    );
  };

  const statusBadge = (status) => {
    const map = {
      "pending_borrow": { text: "Pending Approval", color: "yellow" },
      "borrowed": { text: "Currently Borrowed", color: "blue" },
      "pending_return": { text: "Pending Return", color: "orange" },
      "returned": { text: "Returned", color: "green" }
    };
    const s = map[status] || { text: status, color: "gray" };
    return <span className={`badge badge-${s.color}`}>{s.text}</span>;
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <h1 className="page-title">📖 Borrow Management</h1>

        {/* ── STAT CARDS ── */}
        <div className="stat-grid">
          <StatCard emoji="⏳" label="Pending Approval" value={stats.pending ?? "—"} color="#f57f17" />
          <StatCard emoji="📚" label="Currently Borrowed" value={stats.active ?? "—"} color="#0d47a1" />
          <StatCard emoji="🔁" label="Pending Return" value={stats.pendingReturn ?? "—"} color="#e65100" />
          <StatCard emoji="📊" label="Total Records" value={stats.total ?? "—"} color="#1b5e20" />
        </div>

        {/* ── MANUAL BORROW FORM ── */}
        <div className="card borrow-card">
          <div className="borrow-header" onClick={() => setShowBorrowForm(!showBorrowForm)}>
            <h3>➕ Create Manual Borrow</h3>
            <span className={`toggle ${showBorrowForm ? "open" : ""}`}>▼</span>
          </div>

          {showBorrowForm && (
            <div className="borrow-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Student</label>
                  <Select
                    options={users}
                    value={selectedUser}
                    onChange={setSelectedUser}
                    placeholder="Select student..."
                    styles={customSelectStyle}
                    isSearchable
                  />
                </div>

                <div className="form-group">
                  <label>Book</label>
                  <Select
                    options={books}
                    value={selectedBook}
                    onChange={setSelectedBook}
                    placeholder="Select book..."
                    styles={customSelectStyle}
                    isSearchable
                  />
                </div>

                <button className="create-btn" onClick={handleBorrow}>
                  📤 Create Borrow
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FILTERS ── */}
        <div className="toolbar">
          <div className="search-box">
            <span>🔍</span>
            <input
              placeholder="Search by student name or book title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch("")}>✕</button>}
          </div>

          <div className="filter-buttons">
            {["all", "pending_borrow", "borrowed", "pending_return", "returned"].map((f) => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="card">
          <div className="table-header">
            <span>{borrows.length} record{borrows.length !== 1 ? "s" : ""}</span>
            <button className="refresh-btn" onClick={() => { fetchStats(); fetchBorrows(page, debouncedSearch); }}>
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <p className="loading-text">Loading...</p>
          ) : borrows.length === 0 ? (
            <p className="empty-text">No borrow records found</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {borrows.map((b) => (
                    <tr key={b.id}>
                      <td><strong>{b.full_name}</strong></td>
                      <td>{b.title}</td>
                      <td>{formatDueDate(b.due_date)}</td>
                      <td>{statusBadge(b.status)}</td>
                      <td className="actions-cell">
                        {b.status === "pending_borrow" && (
                          <>
                            <button
                              className="action-btn approve"
                              onClick={() => approveBorrow(b.id)}
                              title="Approve borrow request"
                            >
                              ✔ Approve
                            </button>
                            <button
                              className="action-btn reject"
                              onClick={() => rejectRequest(b.id)}
                              title="Reject request"
                            >
                              ✖ Reject
                            </button>
                          </>
                        )}

                        {b.status === "borrowed" && (
                          <button
                            className="action-btn return"
                            onClick={() => directReturn(b.id)}
                            title="Process return immediately"
                          >
                            🔁 Return
                          </button>
                        )}

                        {b.status === "pending_return" && (
                          <>
                            <button
                              className="action-btn approve"
                              onClick={() => approveReturn(b.id)}
                              title="Approve return"
                            >
                              ✔ Approve
                            </button>
                            <button
                              className="action-btn reject"
                              onClick={() => rejectRequest(b.id)}
                              title="Reject return"
                            >
                              ✖ Reject
                            </button>
                          </>
                        )}

                        {b.status === "returned" && (
                          <span className="completed-badge">✓ Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >◀</button>
            <span>{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >▶</button>
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
          margin-bottom: 24px;
          font-size: 1.5rem;
        }

        /* ── stat cards ── */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 1024px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 18px 20px;
          border: 1px solid #c5e1a5;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .stat-emoji { font-size: 1.8rem; }

        .stat-info label {
          font-size: 0.75rem;
          color: #888;
          display: block;
          margin-bottom: 2px;
        }

        .stat-info strong {
          font-size: 1.6rem;
          font-weight: 700;
        }

        /* ── borrow card ── */
        .borrow-card {
          background: white;
          border-radius: 12px;
          padding: 0;
          border: 1px solid #c5e1a5;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          overflow: hidden;
        }

        .borrow-header {
          padding: 20px;
          background: linear-gradient(135deg, #e8f5e9, #f1f8e9);
          border-bottom: 2px solid #c5e1a5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }

        .borrow-header h3 {
          margin: 0;
          color: #2e7d32;
          font-size: 1.05rem;
        }

        .toggle {
          display: inline-block;
          transition: transform 0.2s;
          color: #2e7d32;
          font-size: 1.2rem;
        }

        .toggle.open { transform: rotate(180deg); }

        .borrow-form {
          padding: 20px;
          background: #fafafa;
          border-top: 1px solid #f0f0f0;
        }

        .form-row {
          display: flex;
          gap: 14px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .form-group {
          flex: 1;
          min-width: 200px;
        }

        .form-group label {
          display: block;
          font-size: 0.85rem;
          color: #555;
          margin-bottom: 6px;
          font-weight: 600;
        }

        .create-btn {
          padding: 10px 20px;
          background: #2e7d32;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.2s;
        }

        .create-btn:hover { opacity: 0.9; }

        /* ── toolbar ── */
        .toolbar {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          align-items: center;
        }

        .search-box {
          display: flex;
          align-items: center;
          background: white;
          border-radius: 8px;
          padding: 8px 12px;
          flex: 1;
          min-width: 250px;
          border: 1px solid #ddd;
          gap: 6px;
        }

        .search-box input {
          border: none;
          outline: none;
          flex: 1;
          font-size: 0.9rem;
        }

        .search-box button {
          background: none;
          border: none;
          cursor: pointer;
          color: #888;
          font-size: 0.9rem;
        }

        .filter-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #c5e1a5;
          background: #e8f5e9;
          color: #2e7d32;
          font-size: 0.82rem;
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .filter-btn:hover { background: #c8e6c9; }
        .filter-btn.active {
          background: #2e7d32;
          color: white;
          border-color: #2e7d32;
        }

        /* ── card ── */
        .card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #c5e1a5;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          font-size: 0.85rem;
          color: #666;
        }

        .refresh-btn {
          background: #e8f5e9;
          border: 1px solid #c5e1a5;
          color: #2e7d32;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 600;
        }

        .refresh-btn:hover { background: #c8e6c9; }

        .loading-text, .empty-text {
          text-align: center;
          color: #888;
          padding: 30px 0;
        }

        /* ── table ── */
        .table-wrap { overflow-x: auto; }

        table { width: 100%; border-collapse: collapse; }

        th {
          background: #e8f5e9;
          padding: 12px;
          text-align: left;
          font-size: 0.82rem;
          color: #2e7d32;
          font-weight: 700;
          white-space: nowrap;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 0.88rem;
        }

        tr:hover td { background: #f9fbe7; }

        .overdue { color: #c62828; font-weight: 600; }

        /* ── badges ── */
        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .badge-yellow { background: #fff9c4; color: #f57f17; }
        .badge-blue   { background: #bbdefb; color: #0d47a1; }
        .badge-orange { background: #ffe0b2; color: #e65100; }
        .badge-green  { background: #c8e6c9; color: #1b5e20; }

        /* ── actions ── */
        .actions-cell {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s;
        }

        .action-btn:hover { opacity: 0.85; }

        .action-btn.approve { background: #2e7d32; color: white; }
        .action-btn.reject  { background: #c62828; color: white; }
        .action-btn.return  { background: #1565c0; color: white; }

        .completed-badge {
          padding: 4px 10px;
          border-radius: 6px;
          background: #c8e6c9;
          color: #1b5e20;
          font-size: 0.76rem;
          font-weight: 700;
        }

        /* ── pagination ── */
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
        }

        .pagination button {
          background: #e8f5e9;
          border: 1px solid #c5e1a5;
          color: #2e7d32;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination span { color: #555; font-size: 0.88rem; }
      `}</style>
    </>
  );
}

function StatCard({ emoji, label, value, color }) {
  return (
    <div className="stat-card">
      <span className="stat-emoji">{emoji}</span>
      <div className="stat-info">
        <label>{label}</label>
        <strong style={{ color }}>{value}</strong>
      </div>
    </div>
  );
}