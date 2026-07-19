// src/pages/VerifyEmail.jsx

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/verify-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Verification failed");
        return;
      }

      alert(data.message || "Email verified! You can now log in.");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      alert("Enter your email first");
      return;
    }

    setResending(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/resend-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await res.json();
      alert(data.message || (res.ok ? "Code resent" : "Failed to resend code"));
    } catch (err) {
      console.error(err);
      alert("Server error. Please try again.");
    } finally {
      setResending(false);
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

          <h2>📧 Verify Your Email</h2>
          <p className="subtitle">
            We sent a 6-digit code to your email. Enter it below to activate your account.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="text"
              name="code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              required
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          <button
            type="button"
            className="resend-btn"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Sending..." : "Resend code"}
          </button>

          <p className="link-text">
            <Link to="/">Back to Login</Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          display: flex;
          height: 100vh;
          font-family: "Poppins", sans-serif;
        }

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
          font-size: 0.9rem;
          line-height: 1.4;
        }

        input[type="text"],
        input[type="email"] {
          width: 100%;
          padding: 12px;
          margin-bottom: 15px;
          border: 1px solid #ccc;
          border-radius: 10px;
          font-size: 1rem;
          text-align: center;
        }

        input[name="code"] {
          letter-spacing: 6px;
          font-weight: 700;
          font-size: 1.2rem;
        }

        input:focus {
          border-color: #2e7d32;
          box-shadow: 0 0 0 3px rgba(46,125,50,0.15);
          outline: none;
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

        .resend-btn {
          background: transparent;
          color: #2e7d32;
          margin-top: 10px;
          border: 1px solid #2e7d32;
        }

        .resend-btn:hover {
          background: #e8f5e9;
        }

        .resend-btn:disabled {
          color: #a5d6a7;
          border-color: #a5d6a7;
          background: transparent;
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