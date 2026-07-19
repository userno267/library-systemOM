// src/pages/Login.jsx

import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { loginUser } = useContext(AuthContext);

  const [lrn, setLrn] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lrn, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Unverified account — send them to the verify screen instead of a dead-end alert.
        if (data.needsVerification && data.email) {
          alert(data.message || "Please verify your email before logging in.");
          navigate(`/verify-email?email=${encodeURIComponent(data.email)}`);
          return;
        }

        return alert(data.message || "Invalid credentials");
      }

      loginUser(data.user, data.token);
      navigate("/home");
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
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

          <h2>📚 LibPortal</h2>
          <p className="subtitle">Welcome back! Please log in.</p>

          <form onSubmit={handleSubmit}>
           <input
  type="text"
  placeholder="Student LRN"
  value={lrn}
  onChange={(e) => setLrn(e.target.value)}
  required
/>

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

            <button type="submit">Login</button>
          </form>

          <p className="link-text">
            Don't have an account? <Link to="/register">Register</Link>
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
        input[type="password"] {
          width: 100%;
          padding: 12px;
          margin-bottom: 15px;
          border: 1px solid #ccc;
          border-radius: 10px;
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