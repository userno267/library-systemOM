import { useState, useEffect, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import QRCode from "qrcode";

export default function Profile() {
  const { token } = useContext(AuthContext);
  const baseURL = import.meta.env.VITE_API_URL;

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const qrCanvasRef = useRef(null);

  /* ===========================
     LOAD PROFILE
  =========================== */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${baseURL}/api/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        setUserId(data.id);
        setName(data.full_name || "");
        setPhone(data.phone || "");
        setBio(data.bio || "");

        if (data.profile_image) {
          const fullURL = `${baseURL}${data.profile_image.startsWith("/") ? "" : "/"}${data.profile_image}`;
          setPreview(fullURL);
        } else {
          setPreview("/default-avatar.png");
        }

        // ── Generate QR from user id ──
        // Format matches existing book QR convention: "BOOK:id" → "USER:id"
        const qrText = `USER:${data.id}`;
        const dataUrl = await QRCode.toDataURL(qrText, {
          width: 200,
          margin: 2,
          color: { dark: "#2e7d32", light: "#f9fbe7" }
        });
        setQrDataUrl(dataUrl);

        setLoading(false);
      } catch (err) {
        console.error("❌ Failed to load profile:", err);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  /* ===========================
     UPDATE PROFILE
  =========================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("bio", bio);
    if (image) formData.append("profile_image", image);

    try {
      const res = await fetch(`${baseURL}/api/users/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      alert("✅ Profile updated!");
      window.location.reload();
    } catch (err) {
      console.error("❌ Failed to update profile:", err);
      alert("Failed to update profile");
    }
  };

  /* ===========================
     DOWNLOAD QR
  =========================== */
  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `student-qr-${userId}.png`;
    link.click();
  };

  if (loading)
    return <p style={{ textAlign: "center", marginTop: "100px" }}>Loading...</p>;

  return (
    <>
      <Sidebar />

      <div className="main">
        <h2>👤 My Profile</h2>

        {/* ── STUDENT QR CODE ── */}
        {qrDataUrl && (
          <div className="qr-card">
            <h3 className="qr-title">🪪 My Library QR</h3>
            <p className="qr-hint">Show this to the librarian to borrow books</p>
            <div className="qr-wrapper">
              <img src={qrDataUrl} alt="Student QR Code" className="qr-image" />
            </div>
            <p className="qr-id">ID: {userId}</p>
            <button className="qr-download-btn" onClick={handleDownloadQR}>
              ⬇️ Download QR
            </button>
          </div>
        )}

        {/* ── PROFILE FORM ── */}
        <form onSubmit={handleSubmit}>
          <div className="image-section">
            <img
              src={preview || "/default-avatar.png"}
              alt="Profile"
              className="profile-img"
              onError={(e) => { e.target.src = "/default-avatar.png"; }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setImage(e.target.files[0]);
                setPreview(URL.createObjectURL(e.target.files[0]));
              }}
            />
          </div>

          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="text"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <textarea
            placeholder="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />

          <button type="submit">Save Changes</button>
        </form>
      </div>

      <BottomNav />

      <style jsx>{`
        .main {
          padding: 80px 16px 100px;
          background: #f9fbe7;
          min-height: 100vh;
          font-family: "Poppins", sans-serif;
        }

        h2 {
          text-align: center;
          margin-bottom: 20px;
          color: #2e7d32;
        }

        /* ── QR card ── */
        .qr-card {
          background: white;
          border: 2px solid #c5e1a5;
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          margin-bottom: 24px;
          box-shadow: 0 2px 10px rgba(46,125,50,0.08);
        }

        .qr-title {
          color: #2e7d32;
          margin-bottom: 4px;
          font-size: 1rem;
        }

        .qr-hint {
          font-size: 0.8rem;
          color: #888;
          margin-bottom: 14px;
        }

        .qr-wrapper {
          display: inline-block;
          padding: 10px;
          background: #f9fbe7;
          border-radius: 12px;
          border: 1px solid #dcedc8;
        }

        .qr-image {
          width: 180px;
          height: 180px;
          display: block;
        }

        .qr-id {
          font-size: 0.78rem;
          color: #aaa;
          margin: 8px 0 12px;
        }

        .qr-download-btn {
          background: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #c5e1a5;
          padding: 8px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.85rem;
          width: auto;
        }

        .qr-download-btn:hover {
          background: #c8e6c9;
        }

        /* ── profile form (unchanged) ── */
        .image-section {
          text-align: center;
          margin-bottom: 20px;
        }

        .profile-img {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          margin-bottom: 10px;
          border: 3px solid #388e3c;
        }

        input,
        textarea {
          width: 100%;
          padding: 10px;
          margin-bottom: 15px;
          border-radius: 8px;
          border: 1px solid #ccc;
          background: #fff;
          box-sizing: border-box;
        }

        form button {
          width: 100%;
          padding: 12px;
          background: #2e7d32;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
        }

        form button:hover {
          opacity: 0.9;
        }
      `}</style>
    </>
  );
}