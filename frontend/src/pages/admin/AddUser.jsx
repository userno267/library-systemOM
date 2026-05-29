import { useState } from "react";
import axios from "axios";
import AdminSidebar from "../../components/AdminSidebar";

export default function AddUser() {
  const [form, setForm] = useState({
    full_name: "",
    lrn: "",
    email: "",
    password: "",
    role: "student",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/users`,
        form,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      alert("User added successfully!");
      setForm({
        full_name: "",
        lrn: "",
        email: "",
        password: "",
        role: "student",
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to add user");
    }

    setLoading(false);
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <div className="form-card">
          <h1 className="title">Add User</h1>

          <form onSubmit={handleSubmit} className="user-form">

            <div className="field">
              <label>Full Name</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label>LRN</label>
              <input
                name="lrn"
                value={form.lrn}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label>Email Address</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* PASSWORD FIELD */}
            <div className="field">
              <label>Password</label>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                required
              />

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={() => setShowPassword(!showPassword)}
                />
                Show password
              </label>

              <small>Use a strong password (min 6 characters recommended)</small>
            </div>

            <div className="field">
              <label>Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? "Adding User..." : "Create User"}
            </button>

          </form>
        </div>
      </div>

      <style >{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .form-card {
          max-width: 520px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 12px;
          padding: 28px;
          border: 1px solid #c5e1a5;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
        }

        .title {
          font-size: 1.6rem;
          font-weight: 700;
          color: #2e7d32;
          margin-bottom: 20px;
        }

        .user-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        label {
          font-size: 0.9rem;
          font-weight: 700;
          color: #4e342e;
        }

        input, select {
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #c5e1a5;
          font-size: 1rem;
        }

        input:focus, select:focus {
          border-color: #2e7d32;
          box-shadow: 0 0 0 3px rgba(46,125,50,0.15);
          outline: none;
        }

        .checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: #6d4c41;
          margin-top: 6px;
          cursor: pointer;
        }

        .checkbox input {
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        small {
          font-size: 0.75rem;
          color: #6d4c41;
        }

        button {
          margin-top: 10px;
          padding: 12px;
          border-radius: 10px;
          border: none;
          font-weight: 700;
          background: #2e7d32;
          color: white;
          cursor: pointer;
        }

        button:hover {
          background: #1b5e20;
          transform: scale(1.02);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}