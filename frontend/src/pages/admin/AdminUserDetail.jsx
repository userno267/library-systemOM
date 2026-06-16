import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import QRCode from "qrcode";

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const baseURL = import.meta.env.VITE_API_URL;

  const [user, setUser] = useState(null);
  const [borrowHistory, setBorrowHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const qrCanvasRef = useRef(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setLoading(true);

        const resUser = await fetch(`${baseURL}/api/users/admin/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (!resUser.ok) throw new Error("Failed user fetch");
        const userData = await resUser.json();

        if (userData.profile_image) {
          setPreview(encodeURI(`${baseURL}${userData.profile_image}`));
        }

        // Generate QR on the fly — no backend needed
        const qr = await QRCode.toDataURL(`USER:${userData.id}`, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 220,
        });
        setQrDataUrl(qr);

        const resHistory = await fetch(
          `${baseURL}/api/borrows/history/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "ngrok-skip-browser-warning": "true",
            },
          }
        );

        const historyData = await resHistory.json();

        setUser(userData);
        setBorrowHistory(historyData);
      } catch (err) {
        console.error(err);
        setUser(null);
        setBorrowHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [id, token, baseURL]);

  // Download QR as PNG
  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `user-qr-${user?.full_name?.replace(/\s+/g, "-") || id}.png`;
    a.click();
  };

  if (loading) {
    return (
      <>
        <AdminSidebar />
        <div className="admin-main center">Loading user profile...</div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AdminSidebar />
        <div className="admin-main center">User not found</div>
      </>
    );
  }

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">

        <button onClick={() => navigate(-1)} className="back-btn">
          ⬅ Back
        </button>

        {/* PROFILE CARD */}
        <div className="profile-card">
          <img
            src={preview || "/default-avatar.png"}
            alt="profile"
            className="profile-pic"
            onError={(e) => (e.target.src = "/default-avatar.png")}
          />

          <div className="profile-info">
            <h1>
              {user.full_name}{" "}
              <span className="role">({user.role})</span>
            </h1>

            <div className="info-grid">
              <p><span>Email:</span> {user.email}</p>
              <p><span>LRN:</span> {user.lrn || "N/A"}</p>
              <p><span>Phone:</span> {user.phone || "N/A"}</p>
              <p><span>Bio:</span> {user.bio || "N/A"}</p>
              <p>
                <span>Joined:</span>{" "}
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* QR CODE */}
          {qrDataUrl && (
            <div className="qr-section">
              <p className="qr-label">📱 Student QR Code</p>
              <img
                src={qrDataUrl}
                alt="User QR Code"
                className="qr-img"
              />
              <p className="qr-hint">Scan at QR Borrow Station</p>
              <button className="qr-download-btn" onClick={handleDownloadQR}>
                ⬇ Download QR
              </button>
            </div>
          )}
        </div>

        {/* HISTORY */}
        <h2 className="section-title">📚 Borrow History</h2>

        {borrowHistory.length === 0 ? (
          <p className="empty">No borrow history found</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Type</th>
                <th>Borrowed</th>
                <th>Due</th>
                <th>Returned</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {borrowHistory.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.type}</td>
                  <td>{new Date(b.borrowed_at).toLocaleDateString()}</td>
                  <td>{new Date(b.due_date).toLocaleDateString()}</td>
                  <td>
                    {b.returned_at
                      ? new Date(b.returned_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>
                    <span className={`status ${b.status}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .center {
          text-align: center;
          color: #6d4c41;
          padding-top: 50px;
        }

        .back-btn {
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          background: #2e7d32;
          color: white;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 20px;
        }

        .profile-card {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          background: white;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid #c5e1a5;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
          margin-bottom: 25px;
          flex-wrap: wrap;
        }

        .profile-pic {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #2e7d32;
          flex-shrink: 0;
        }

        .profile-info {
          flex: 1;
          min-width: 200px;
        }

        .profile-info h1 {
          margin: 0;
          color: #2e7d32;
        }

        .role {
          font-size: 0.9rem;
          color: #6d4c41;
        }

        .info-grid {
          margin-top: 10px;
          display: grid;
          gap: 6px;
        }

        .info-grid span {
          font-weight: 700;
          color: #4e342e;
        }

        /* QR SECTION */
        .qr-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          border-left: 1px solid #e0e0e0;
          padding-left: 24px;
          flex-shrink: 0;
        }

        .qr-label {
          font-weight: 700;
          color: #2e7d32;
          font-size: 0.85rem;
          margin: 0;
        }

        .qr-img {
          width: 160px;
          height: 160px;
          border-radius: 10px;
          border: 2px solid #c5e1a5;
          padding: 6px;
          background: white;
        }

        .qr-hint {
          font-size: 0.72rem;
          color: #999;
          margin: 0;
          text-align: center;
        }

        .qr-download-btn {
          background: #e8f5e9;
          border: 1px solid #a5d6a7;
          color: #2e7d32;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: 0.2s;
        }

        .qr-download-btn:hover {
          background: #c8e6c9;
        }

        .section-title {
          color: #2e7d32;
          margin-top: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #c5e1a5;
        }

        th {
          background: #c5e1a5;
          color: #1b5e20;
          padding: 12px;
          text-align: left;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #eee;
        }

        .status {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status.returned { background: #c8e6c9; color: #1b5e20; }
        .status.borrowed { background: #fff3cd; color: #6d4c41; }

        .empty { color: #6d4c41; }
      `}</style>
    </>
  );
}