import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import BottomNav, { notificationBus } from "../components/BottomNav"; // ✅ import bus
import socket from "../socket";

export default function NotificationsPage() {
  const { user, token } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const baseURL = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  /* ===========================
     FETCH NOTIFICATIONS
  =========================== */
  useEffect(() => {
    if (!user || !token) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${baseURL}/api/notifications`, {
          headers: {
            "ngrok-skip-browser-warning": "true",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setNotifications(
          Array.isArray(data)
            ? data.map((n) => ({ ...n, expanded: false, isRead: !!n.is_read }))
            : []
        );
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user, token]);

  /* ===========================
     SOCKET
  =========================== */
  useEffect(() => {
    if (!user || !token) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    const handleConnect = () => socket.emit("join", user.id);
    socket.on("connect", handleConnect);

    const handleNotification = (data) => {
      setNotifications((prev) => [
        { ...data, expanded: false, isRead: false },
        ...prev,
      ]);
    };
    socket.on("newNotification", handleNotification);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("newNotification", handleNotification);
    };
  }, [user, token]);

  /* ===========================
     TOGGLE EXPAND (mark single read)
  =========================== */
  const toggleExpand = async (id) => {
    // Update local state immediately
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, expanded: !n.expanded, isRead: true } : n
      )
    );

    try {
      await fetch(`${baseURL}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          "ngrok-skip-browser-warning": "true",
          Authorization: `Bearer ${token}`,
        },
      });

      // ✅ Tell BottomNav to re-fetch the real unread count
      notificationBus.emit();
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read:`, err);
    }
  };

  /* ===========================
     MARK ALL AS READ
  =========================== */
  const markAllAsRead = async () => {
    // Update local state immediately
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await fetch(`${baseURL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: {
          "ngrok-skip-browser-warning": "true",
          Authorization: `Bearer ${token}`,
        },
      });

      // ✅ Tell BottomNav to re-fetch the real unread count
      notificationBus.emit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  if (loading)
    return <p style={{ textAlign: "center", marginTop: "100px" }}>Loading...</p>;

  return (
    <>
      <Sidebar />

      <div className="main">
        <h2>🔔 Notifications</h2>

        {notifications.length > 0 && (
          <button className="read-all" onClick={markAllAsRead}>
            Mark All as Read
          </button>
        )}

        {notifications.length === 0 ? (
          <p className="center">No notifications yet.</p>
        ) : (
          <ul className="notification-list">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`notification-item ${n.isRead ? "read" : "unread"}`}
                onClick={() => toggleExpand(n.id)}
              >
                <strong>{n.message}</strong>
                {n.expanded && (
                  <div className="details">
                    <p>Type: {n.type}</p>
                    <p>Sent: {new Date(n.created_at).toLocaleString()}</p>
                    <p>Message: {n.message}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />

      <style jsx>{`
        .main {
          padding: 80px 16px 120px;
          background: #f9fbe7;
          min-height: 100vh;
          font-family: "Poppins", sans-serif;
          position: relative;
          z-index: 10;
        }

        h2 {
          text-align: center;
          margin-bottom: 20px;
          color: #2e7d32;
        }

        .read-all {
          display: block;
          margin: 0 auto 20px auto;
          padding: 8px 16px;
          background: #2e7d32;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s ease;
        }

        .read-all:hover { background: #1b5e20; }

        .notification-list {
          list-style: none;
          padding: 0;
          margin: 0;
          padding-bottom: 40px;
        }

        .notification-item {
          background: #fff;
          padding: 12px;
          margin-bottom: 10px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.08);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease, filter 0.2s ease;
          position: relative;
          z-index: 100;
        }

        .notification-item.unread {
          border-left: 4px solid #388e3c;
          filter: none;
        }

        .notification-item.read {
          filter: brightness(85%);
        }

        .notification-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.12);
        }

        .details {
          margin-top: 8px;
          font-size: 0.85rem;
          color: #555;
          line-height: 1.4;
          border-top: 1px solid #eee;
          padding-top: 6px;
        }

        .center {
          text-align: center;
          color: #777;
          margin-top: 40px;
        }

        @media (min-width: 768px) {
          .main { padding-left: 260px; }
        }
      `}</style>
    </>
  );
}