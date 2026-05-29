import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

export default function Profile() {
  const { token } = useContext(AuthContext);
  const baseURL = import.meta.env.VITE_API_URL;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  /* ===========================
     LOAD PROFILE
  =========================== */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        console.log("🔹 Fetching profile...");
        const res = await fetch(`${baseURL}/api/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        console.log("🔹 Profile data:", data);

        setName(data.full_name || "");
        setPhone(data.phone || "");
        setBio(data.bio || "");

        if (data.profile_image) {
          // Ensure proper concatenation
          const fullURL = `${baseURL}${data.profile_image.startsWith("/") ? "" : "/"}${data.profile_image}`;
          console.log("🔹 Profile image URL:", fullURL);
          setPreview(fullURL);
        } else {
          console.log("🔹 No profile image set");
          setPreview("/default-avatar.png");
        }

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
      console.log("🔹 Submitting profile update...");
      const res = await fetch(`${baseURL}/api/users/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      console.log("✅ Profile updated successfully");
      alert("✅ Profile updated!");
      window.location.reload();
    } catch (err) {
      console.error("❌ Failed to update profile:", err);
      alert("Failed to update profile");
    }
  };

  if (loading)
    return <p style={{ textAlign: "center", marginTop: "100px" }}>Loading...</p>;

  return (
    <>
      <Sidebar />

      <div className="main">
        <h2>👤 My Profile</h2>

        <form onSubmit={handleSubmit}>
          <div className="image-section">
            <img
              src={preview || "/default-avatar.png"}
              alt="Profile"
              className="profile-img"
              onError={(e) => {
                console.warn("⚠️ Profile image failed to load, using default");
                e.target.src = "/default-avatar.png";
              }}
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setImage(e.target.files[0]);
                const objectURL = URL.createObjectURL(e.target.files[0]);
                console.log("🔹 Previewing selected image:", objectURL);
                setPreview(objectURL);
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
        }

        form button {
          width: 100%;
          padding: 12px;
          background: #2e7d32;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: bold;
        }

        button:hover {
          opacity: 0.9;
        }
          
      `}</style>
    </>
  );
}