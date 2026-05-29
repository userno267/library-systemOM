import { useState, useContext } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { AuthContext } from "../../context/AuthContext";

export default function AdminNotifications() {
  const { token } = useContext(AuthContext);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Title and message are required.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notifications/admin/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true"
          },
          body: JSON.stringify({
            title,
            message,
            userId: userId || null
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert("✅ Notification sent successfully!");

      setTitle("");
      setMessage("");
      setUserId("");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to send notification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <div className="header">
          <div>
            <h1>Admin Notifications</h1>
            <p>Send custom notifications to users</p>
          </div>
        </div>

        <div className="form-card">
          <div className="form-group">
            <label>Notification Title</label>
            <input
              type="text"
              placeholder="Enter notification title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Notification Message</label>
            <textarea
              placeholder="Enter notification message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>User ID (Optional)</label>
            <input
              type="number"
              placeholder="Leave empty to send to all students"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>

          <button
            className="send-btn"
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Notification"}
          </button>
        </div>
      </div>

      <style >{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .header {
          margin-bottom: 20px;
        }

        .form-card {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.08);
          max-width: 600px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
          color: #1b5e20;
        }

        input,
        textarea {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
        }

        textarea {
          min-height: 120px;
        }

        .send-btn {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: bold;
          width: 100%;
        }

        .send-btn:disabled {
          opacity: 0.6;
        }

        button:hover {
          opacity: 0.9;
          transform: scale(1.03);
          cursor: pointer;
        }
      `}</style>
    </>
  );
}