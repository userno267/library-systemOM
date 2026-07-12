import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaHome, FaUser, FaBell, FaQrcode } from "react-icons/fa";
import { useEffect, useState, useContext } from "react";
import socket from "../socket";
import { AuthContext } from "../context/AuthContext";

// =====================================================
// Simple event bus so NotificationsPage can tell
// BottomNav to re-fetch the unread count after reads
// without prop drilling or a global state library
// =====================================================
export const notificationBus = {
  _listeners: [],
  on(fn) { this._listeners.push(fn); },
  off(fn) { this._listeners = this._listeners.filter(l => l !== fn); },
  emit() { this._listeners.forEach(fn => fn()); },
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);

  const baseURL = import.meta.env.VITE_API_URL;

  const handleScanClick = () => navigate("/scan");

  /* ==============================
     FETCH REAL UNREAD COUNT
     Called on mount + whenever
     NotificationsPage marks reads
  ============================== */
  const fetchUnread = async () => {
    if (!user || !token) return;
    try {
      const res = await fetch(`${baseURL}/api/notifications/unread-count`, {
        headers: {
          "ngrok-skip-browser-warning": "true",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (typeof data.count === "number") {
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user && token) fetchUnread();
  }, [user?.id, token]);

  /* ==============================
     LISTEN TO NOTIFICATION BUS
     NotificationsPage calls
     notificationBus.emit() after
     marking read — we re-fetch here
  ============================== */
  useEffect(() => {
    notificationBus.on(fetchUnread);
    return () => notificationBus.off(fetchUnread);
  }, [user?.id, token]);

  /* ==============================
     SOCKET — increment on new
     notification arriving
  ============================== */
  useEffect(() => {
    if (!user?.id || !token) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    const handleConnect = () => socket.emit("join", user.id);
    const handleNewNotification = () => setUnreadCount((prev) => prev + 1);

    socket.on("connect", handleConnect);
    socket.on("newNotification", handleNewNotification);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("newNotification", handleNewNotification);
    };
  }, [user?.id, token]);

  /* ==============================
     NAV ITEMS
  ============================== */
  const navItems = [
    { type: "link", href: "/home", icon: <FaHome />, label: "Home" },
    { type: "link", href: "/Profile", icon: <FaUser />, label: "Profile" },
    {
      type: "link",
      href: "/Notification",
      icon: <FaBell />,
      label: "Alerts",
      badge: unreadCount,
    },
    {
      type: "button",
      icon: <FaQrcode />,
      label: "Scan",
      onClick: handleScanClick,
    },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item, index) =>
        item.type === "link" ? (
          <Link
            key={index}
            to={item.href}
            className={`nav-item ${location.pathname === item.href ? "active" : ""}`}
          >
            <div className="icon-wrapper">
              {item.icon}
              {item.badge > 0 && (
                <span className="badge">{item.badge}</span>
              )}
            </div>
            <span>{item.label}</span>
          </Link>
        ) : (
          <button key={index} onClick={item.onClick} className="nav-item">
            <div className="icon-wrapper">{item.icon}</div>
            <span>{item.label}</span>
          </button>
        )
      )}

      <style jsx>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 65px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(90deg, #388e3c, #fdd835);
          box-shadow: 0 -3px 12px rgba(0, 0, 0, 0.2);
          padding: 0 8px;
          padding-bottom: env(safe-area-inset-bottom);
          z-index: 999;
          overflow: visible;
        }

        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.75rem;
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: none;
          position: relative;
          transition: all 0.25s ease;
          z-index: 1;
        }

        .nav-item svg {
          font-size: 1.4rem;
          margin-bottom: 3px;
          transition: transform 0.2s ease;
        }

        .icon-wrapper {
          position: relative;
          overflow: visible;
        }

        .badge {
          position: absolute;
          top: -6px;
          right: -10px;
          background: #ff1744;
          color: white;
          font-size: 0.6rem;
          padding: 2px 6px;
          border-radius: 12px;
          font-weight: bold;
          min-width: 18px;
          text-align: center;
          z-index: 100;
          box-shadow: 0 0 0 2px white;
        }

        .nav-item.active {
          color: #222;
          font-weight: 600;
          transform: translateY(-4px);
        }

        .nav-item.active svg {
          transform: scale(1.15);
        }

        .nav-item:hover { color: #222; }
      `}</style>
    </nav>
  );
}