// src/components/AdminSidebar.jsx

import { useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logoutUser } = useContext(AuthContext);

  const navGroups = [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", path: "/admin/dashboard", emoji: "📊" },
      ],
    },
    {
      title: "Library",
      items: [
        { label: "Book Management", path: "/admin/BookManagement", emoji: "📚" },
        { label: "Borrow Management", path: "/admin/ActiveBorrowManagement", emoji: "📖" },
        { label: "QR Printing", path: "/admin/QRPrinting", emoji: "🖨️" },
      ],
    },
    {
      title: "Users",
      items: [
        { label: "User Management", path: "/admin/UserManagement", emoji: "👥" },
        { label: "Chat", path: "/admin/ChatManagement", emoji: "💬" },
      ],
    },
    {
      title: "Analytics",
      items: [
        { label: "Reports", path: "/admin/Report", emoji: "📈" },
      ],
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    logoutUser();
    navigate("/login");
  };

  return (
    <>
      <div className="admin-sidebar">
        <h2 className="logo">🏫 LibPortal Admin</h2>

        {/* NAV (scrollable only) */}
        <div className="nav-container">
          {navGroups.map((group) => (
            <div key={group.title} className="group">
              <p className="group-title">{group.title}</p>

              {group.items.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className={
                    location.pathname === item.path ? "active" : ""
                  }
                >
                  {item.emoji} {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* LOGOUT ALWAYS VISIBLE */}
        <div className="logout-container">
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .admin-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 260px;

          /* 🔥 FIX: dynamic viewport instead of rigid 100vh */
          height: 100dvh;

          background: linear-gradient(180deg, #1b5e20 0%, #c0ca33 100%);
          color: #fff;

          display: flex;
          flex-direction: column;

          padding: 20px 0;
          box-sizing: border-box;
        }

        .logo {
          text-align: center;
          font-weight: 800;
          margin-bottom: 15px;
        }

        /* 🔥 ONLY THIS SCROLLS */
        

        .group {
          margin-bottom: 18px;
        }

        .group-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          opacity: 0.7;
          margin-bottom: 8px;
          padding-left: 10px;
        }

        a {
          display: flex;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 10px;
          color: #fff;
          text-decoration: none;
          margin-bottom: 6px;
          background: rgba(255, 255, 255, 0.1);
        }

        a:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        a.active {
          background: rgba(255, 255, 255, 0.35);
        }

        /* 🔥 pinned naturally at bottom */
        .logout-container {
          padding: 10px 15px;
        }

        .logout-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: rgba(0, 0, 0, 0.35);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }

        .logout-btn:hover {
          background: rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </>
  );
}