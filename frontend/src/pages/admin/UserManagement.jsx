// src/pages/admin/UserManagement.jsx

import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { useNavigate } from "react-router-dom";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState([]);

  const navigate = useNavigate();
  const limit = 10;
  const token = localStorage.getItem("token");

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page,
        limit,
        search,
        role: roleFilter === "all" ? "" : roleFilter,
      });

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/users?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "anyvalue",
          },
        }
      );

      const data = await res.json();

      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, roleFilter]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this user?")) return;

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setSelected((prev) => prev.filter((x) => x !== id));
      fetchUsers();
    } catch (err) {
      console.error(err);
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
    const pageIds = users.map((u) => u.id);

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
    if (!selected.length) return alert("No users selected");
    if (!confirm(`Delete ${selected.length} users?`)) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/users/bulk-delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids: selected }),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      alert(`${data.deleted} users deleted`);

      setSelected([]);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <div className="header">
  <div>
    <h1>User Management</h1>
    <p>Manage your system users</p>
  </div>

  <div className="header-actions">
    <button
      className="add-btn"
      onClick={() => navigate("/admin/add-user")}
    >
      ➕ Add User
    </button>

    <button
      className="noti-btn"
      onClick={() => navigate("/admin/AdminNotifications")}
    >
      🔔 Annoucement
    </button>
  </div>
</div>

        <div className="controls">
          <input
            placeholder="🔍 Search by name, LRN, or email"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />

          <select
            value={roleFilter}
            onChange={(e) => {
              setPage(1);
              setRoleFilter(e.target.value);
            }}
          >
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
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
          <p className="center">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="center">No users found.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        users.length > 0 &&
                        users.every((u) => selected.includes(u.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>

                  <th>ID</th>
                  <th>Full Name</th>
                  <th>LRN</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(user.id)}
                        onChange={() => toggleSelect(user.id)}
                      />
                    </td>

                    <td>{user.id}</td>
                    <td>{user.full_name}</td>
                    <td>{user.lrn}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>

                    <td className="actions">
                      <button
                        className="edit"
                        onClick={() =>
                          navigate(`/admin/edit-user/${user.id}`)
                        }
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          navigate(`/admin/AdminUserDetail/${user.id}`)
                        }
                      >
                        👁 View
                      </button>

                      <button
                        className="delete"
                        onClick={() => handleDelete(user.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                ◀
              </button>

              <span>
                Page {page} of {totalPages}
              </span>

              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                ▶
              </button>
            </div>
          </>
        )}
      </div>

      <style >{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .controls {
          display: flex;
          gap: 10px;
          margin: 20px 0;
        }

        input, select {
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 10px;
          overflow: hidden;
        }

        th, td {
          padding: 12px;
          border-bottom: 1px solid #ddd;
        }

        th {
          background: #c5e1a5;
          color: #1b5e20;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .edit {
          background: #43a047;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 8px;
        }

        .delete {
          background: #e53935;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 8px;
        }

       
        .pagination {
          margin-top: 20px;
          display: flex;
          justify-content: center;
          gap: 15px;
        }

        .pagination button {
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          background: #2e7d32;
          color: white;
        }
 .add-btn {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: bold;
        }
.noti-btn {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: bold;
        }
        .pagination button:disabled {
          opacity: 0.4;
        }

        .center {
          text-align: center;
          color: #777;
        }

        /* ================= SAME BULK STYLE AS BOOKS ================= */
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