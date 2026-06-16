// src/pages/admin/AttendanceManagement.jsx

import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";

export default function AttendanceManagement() {
  const baseURL = import.meta.env.VITE_API_URL;
  const token   = localStorage.getItem("token");
  const headers = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true"
  };

  const [attendance, setAttendance] = useState([]);
  const [stats, setStats]           = useState({});
  const [search, setSearch]         = useState("");
  const [date, setDate]             = useState(todayDate());
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);

  function todayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  const fetchStats = async () => {
    try {
      const res  = await fetch(`${baseURL}/api/attendance/stats`, { headers });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Stats error:", err);
    }
  };

  const fetchAttendance = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:   p,
        limit:  20,
        search,
        date
      });

      const res  = await fetch(
        `${baseURL}/api/attendance?${params.toString()}`,
        { headers }
      );
      const data = await res.json();

      setAttendance(data.attendance || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Attendance fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchAttendance(1);
  }, [search, date]);

  useEffect(() => {
    fetchAttendance(page);
  }, [page]);

  const formatTime = (dt) => {
    if (!dt) return <span className="null-badge">—</span>;
    return new Date(dt).toLocaleTimeString([], {
      hour:   "2-digit",
      minute: "2-digit"
    });
  };

  const getDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return "—";
    const diff = new Date(timeOut) - new Date(timeIn);
    const hrs  = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  const statusBadge = (row) => {
    if (!row.time_out) {
      return <span className="badge badge-in">Still Inside</span>;
    }
    return <span className="badge badge-out">Completed</span>;
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <h1 className="page-title">📋 Attendance Management</h1>

        {/* ── STAT CARDS ── */}
        <div className="stat-grid">
          <StatCard emoji="🟢" label="Currently Inside"  value={stats.currentlyIn  ?? "—"} color="#2e7d32" />
          <StatCard emoji="👥" label="Today's Total"     value={stats.todayTotal   ?? "—"} color="#1565c0" />
          <StatCard emoji="✅" label="Timed Out Today"   value={stats.todayOut     ?? "—"} color="#6a1b9a" />
          <StatCard emoji="📊" label="All Time Records"  value={stats.allTimeTotal ?? "—"} color="#e65100" />
        </div>

        {/* ── FILTERS ── */}
        <div className="toolbar">
          <div className="search-box">
            <span>🔍</span>
            <input
              placeholder="Search by name or LRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          <div className="date-filter">
            <label>📅 Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              className="today-btn"
              onClick={() => setDate(todayDate())}
            >
              Today
            </button>
            <button
              className="all-btn"
              onClick={() => setDate("")}
            >
              All Dates
            </button>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="card">
          <div className="table-header">
            <span>{total} record{total !== 1 ? "s" : ""} found</span>
            <button className="refresh-btn" onClick={() => { fetchStats(); fetchAttendance(page); }}>
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <p className="loading-text">Loading...</p>
          ) : attendance.length === 0 ? (
            <p className="empty-text">No attendance records found</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>LRN</th>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.full_name}</strong></td>
                      <td className="mono">{row.lrn || "—"}</td>
                      <td>{row.date}</td>
                      <td className="time-in">{formatTime(row.time_in)}</td>
                      <td className="time-out">{formatTime(row.time_out)}</td>
                      <td>{getDuration(row.time_in, row.time_out)}</td>
                      <td>{statusBadge(row)}</td>
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

        @media (max-width: 900px) {
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
          min-width: 200px;
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

        .date-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .date-filter label {
          font-size: 0.85rem;
          color: #555;
          white-space: nowrap;
        }

        .date-filter input[type="date"] {
          padding: 7px 10px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 0.85rem;
          background: white;
        }

        .today-btn, .all-btn {
          padding: 7px 12px;
          border-radius: 8px;
          border: 1px solid #c5e1a5;
          background: #e8f5e9;
          color: #2e7d32;
          font-size: 0.82rem;
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
        }

        .today-btn:hover, .all-btn:hover { background: #c8e6c9; }

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
          padding: 10px 12px;
          text-align: left;
          font-size: 0.82rem;
          color: #2e7d32;
          white-space: nowrap;
        }

        td {
          padding: 10px 12px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 0.88rem;
        }

        tr:hover td { background: #f9fbe7; }

        .mono { font-family: monospace; font-size: 0.82rem; color: #666; }

        .time-in  { color: #2e7d32; font-weight: 600; }
        .time-out { color: #c62828; font-weight: 600; }

        .null-badge {
          color: #bbb;
          font-style: italic;
        }

        /* ── badges ── */
        .badge {
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .badge-in  { background: #c8e6c9; color: #1b5e20; }
        .badge-out { background: #e8eaf6; color: #283593; }

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