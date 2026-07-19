// src/pages/Register.jsx

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    lrn: "",
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Registration failed");
        return;
      }

      // Registration creates an unverified account and emails a code —
      // send them straight to the verification screen.
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      console.error(err);
      alert("Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">

      {/* ================= LEFT (DESKTOP) ================= */}
      <div className="left-panel">
        <div className="branding">
          <img src="/278737963_102029019168954_7338134888722766049_n.jpg" alt="School Logo" />
          <h1>Oriental Mindoro National High School</h1>
          <p>Library Management System</p>
        </div>
      </div>

      {/* ================= RIGHT ================= */}
      <div className="right-panel">
        <div className="auth-card">

          {/* MOBILE LOGO */}
          <div className="mobile-logo">
            <img src="/278737963_102029019168954_7338134888722766049_n.jpg" alt="Logo" />
          </div>

          <h2>📝 Register</h2>
          <p className="subtitle">Create your library account</p>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="full_name"
              placeholder="Full Name"
              value={form.full_name}
              onChange={handleChange}
              required
            />

            <input
              type="text"
              name="lrn"
              placeholder="Student LRN"
              value={form.lrn}
              onChange={handleChange}
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />

            {/* SHOW PASSWORD */}
            <div className="show-password">
              <input
                type="checkbox"
                id="showPass"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
              />
              <label htmlFor="showPass">Show Password</label>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Register"}
            </button>
          </form>

          <p className="link-text">
            Already have an account? <Link to="/">Login</Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          display: flex;
          height: 100vh;
          font-family: "Poppins", sans-serif;
        }

        /* ================= LEFT ================= */
        .left-panel {
          flex: 1;
          background: linear-gradient(135deg, #2e7d32, #a5d6a7);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px;
        }

        .branding {
          text-align: center;
          max-width: 400px;
        }

        .branding img {
          width: 120px;
          margin-bottom: 20px;
        }

        .branding h1 {
          font-size: 1.8rem;
          margin-bottom: 10px;
        }

        /* ================= RIGHT ================= */
        .right-panel {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #f9fbe7;
        }

        .auth-card {
          background: #fff;
          border-radius: 16px;
          padding: 40px 30px;
          width: 90%;
          max-width: 380px;
          text-align: center;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }

        h2 {
          color: #2e7d32;
          margin-bottom: 10px;
        }

        .subtitle {
          color: #555;
          margin-bottom: 25px;
        }

        input[type="text"],
        input[type="email"],
        input[type="password"] {
          width: 100%;
          padding: 12px;
          margin-bottom: 15px;
          border: 1px solid #ccc;
          border-radius: 10px;
          font-size: 1rem;
        }

        input:focus {
          border-color: #2e7d32;
          box-shadow: 0 0 0 3px rgba(46,125,50,0.15);
          outline: none;
        }

        .show-password {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 15px;
          font-size: 0.9rem;
          color: #555;
        }

        button {
          background: #2e7d32;
          color: white;
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        button:hover {
          background: #388e3c;
        }

        button:disabled {
          background: #a5d6a7;
          cursor: not-allowed;
        }

        .link-text {
          margin-top: 15px;
          color: #555;
        }

        a {
          color: #2e7d32;
          font-weight: 600;
          text-decoration: none;
        }

        /* ================= MOBILE ================= */
        .mobile-logo {
          display: none;
        }

        @media (max-width: 768px) {
          .auth-container {
            flex-direction: column;
          }

          .left-panel {
            display: none;
          }

          .right-panel {
            background: linear-gradient(135deg, #2e7d32, #fdd835);
          }

          .mobile-logo {
            display: block;
            margin-bottom: 15px;
          }

          .mobile-logo img {
            width: 80px;
          }
        }
      `}</style>
    </div>
  );
}