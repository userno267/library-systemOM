import { useState, useEffect, useContext, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaBookOpen,
  FaBook,
  FaLaptop,
  FaComments,
  FaBars,
  FaSignOutAlt,
} from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { logoutUser } = useContext(AuthContext);

  const navItems = [
    { path: "/", icon: <FaHome />, label: "Dashboard" },
    { path: "/BrowseBooks", icon: <FaBookOpen />, label: "Browse Books" },
    { path: "/UserBorrowPage", icon: <FaBook />, label: "Borrowed Books" },
    { path: "/BrowseEBooks", icon: <FaLaptop />, label: "E-books" },
    { path: "/SupportChat", icon: <FaComments />, label: "Chat Librarian" },
    {
      path: "/logout",
      icon: <FaSignOutAlt />,
      label: "Logout",
      action: () => {
        logoutUser();
        navigate("/login");
      },
    },
  ];

  // ================= RESIZE (desktop auto open) =================
  useEffect(() => {
    const handleResize = () => setOpen(window.innerWidth > 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ================= OUTSIDE CLICK CLOSE =================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        open &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        window.innerWidth <= 768
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // ================= NAV CLICK =================
  const handleNavClick = (item) => {
    if (item.action) item.action();

    if (window.innerWidth <= 768) {
      setOpen(false);
    }
  };

  return (
    <>
      {/* ================= OVERLAY ================= */}
      {open && window.innerWidth <= 768 && (
        <div className="overlay" onClick={() => setOpen(false)} />
      )}

      {/* ================= TOGGLE BUTTON ================= */}
      <button className="toggle-btn" onClick={() => setOpen(!open)}>
        <FaBars />
      </button>

      {/* ================= SIDEBAR ================= */}
      <div ref={sidebarRef} className={`sidebar ${open ? "open" : ""}`}>
        <div className="logo">LibPortal</div>

        <ul className="nav-list">
          {navItems.map((item) => (
            <li
              key={item.label}
              className={
                location.pathname === item.path ? "active" : ""
              }
            >
              {item.action ? (
                <button onClick={() => handleNavClick(item)}>
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ) : (
                <Link
                  to={item.path}
                  onClick={() => handleNavClick(item)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>

      <style jsx>{`
        /* ================= TOGGLE ================= */
        .toggle-btn {
          position: fixed;
          top: 15px;
          left: 15px;
          background: #2e7d32;
          border: none;
          color: #fff;
          padding: 10px;
          border-radius: 12px;
          z-index: 3000;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .toggle-btn:hover {
          transform: scale(1.05);
        }

        /* ================= OVERLAY ================= */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 1500;
          backdrop-filter: blur(2px);
        }

        /* ================= SIDEBAR ================= */
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 240px;
          height: 100vh;
          background: linear-gradient(
            180deg,
            #1b5e20,
            #66bb6a,
            #fdd835
          );
          color: #fff;
          padding-top: 70px;

          transform: translateX(-100%);
          transition: transform 0.3s ease;
          z-index: 2000;
        }

        .sidebar.open {
          transform: translateX(0);
        }

        /* ================= LOGO ================= */
        .logo {
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 40px;
          animation: fadeDown 0.4s ease;
        }

        /* ================= NAV ================= */
        .nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .nav-list li {
          margin: 6px 10px;
        }

        .nav-list a,
        .nav-list button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          color: #fff;
          text-decoration: none;
          border-radius: 10px;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: 0.2s ease;
          font-size: 0.95rem;
        }

        .nav-list a:hover,
        .nav-list button:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateX(4px);
        }

        /* ACTIVE ITEM */
        .nav-list li.active a {
          background: rgba(255, 255, 255, 0.25);
          font-weight: 700;
        }

        /* ================= ANIMATION ================= */
        @keyframes fadeDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}