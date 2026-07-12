// src/pages/QRBorrowStation.jsx

import { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

const STATUS = {
  IDLE:           "idle",
  USER_SCANNED:   "user_scanned",
  REVIEW:         "review",
  LOADING:        "loading",
  SUCCESS:        "success",
  ERROR:          "error",
};

export default function QRBorrowStation() {
  const baseURL = import.meta.env.VITE_API_URL;
  const token   = localStorage.getItem("token");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };

  const [resolvedUser, setResolvedUser] = useState(null);
  const [resolvedBook, setResolvedBook] = useState(null);
  const [status, setStatus]             = useState(STATUS.IDLE);
  const [message, setMessage]           = useState("");
  const [wrongScan, setWrongScan]       = useState("");

  const scannerRef      = useRef(null);
  const resolvedUserRef = useRef(null);

  useEffect(() => { resolvedUserRef.current = resolvedUser; }, [resolvedUser]);

  const startScanner = (divId, expectedPrefix, onSuccess) => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }

    const scanner = new Html5QrcodeScanner(divId, { fps: 10, qrbox: 220 }, false);

    scanner.render(
      (decodedText) => {
        if (!decodedText.startsWith(expectedPrefix)) {
          const expected = expectedPrefix === "USER:" ? "student" : "book";
          const got      = decodedText.startsWith("USER:") ? "student"
                         : decodedText.startsWith("BOOK:") ? "book"
                         : "unknown";

          setWrongScan(`That's a ${got} QR. Please scan a ${expected} QR.`);

          setTimeout(() => {
            setWrongScan("");
            startScanner(divId, expectedPrefix, onSuccess);
          }, 2500);

          return;
        }

        setWrongScan("");
        scanner.clear().catch(() => {});
        scannerRef.current = null;
        onSuccess(decodedText);
      },
      (err) => console.warn(err)
    );

    scannerRef.current = scanner;
  };

  useEffect(() => {
    return () => { if (scannerRef.current) scannerRef.current.clear().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (status === STATUS.IDLE) {
      setTimeout(() => startScanner("user-reader", "USER:", handleUserScanned), 300);
    }
  }, [status]);

  useEffect(() => {
    if (status === STATUS.USER_SCANNED) {
      setTimeout(() => startScanner("book-reader", "BOOK:", handleBookScanned), 300);
    }
  }, [status]);

  const handleUserScanned = async (raw) => {
    const userId = raw.split(":")[1];

    if (!userId || isNaN(userId)) {
      setMessage("❌ Invalid student QR");
      setStatus(STATUS.ERROR);
      return;
    }

    try {
      const url = `${baseURL}/api/users/admin/${userId}`;
      const res  = await fetch(url, { headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Student not found");

      setResolvedUser(data);
      setMessage("");
      setStatus(STATUS.USER_SCANNED);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setStatus(STATUS.ERROR);
    }
  };

  const handleBookScanned = async (raw) => {
    const bookId = raw.split(":")[1];

    if (!bookId || isNaN(bookId)) {
      setMessage("❌ Invalid book QR");
      setStatus(STATUS.ERROR);
      return;
    }

    try {
      const url  = `${baseURL}/api/books/${bookId}`;
      const res  = await fetch(url, { headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Book not found");

      setResolvedBook(data);
      setMessage("");
      setStatus(STATUS.REVIEW);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setStatus(STATUS.ERROR);
    }
  };

  const submitBorrow = async () => {
    const currentUser = resolvedUserRef.current;

    if (!currentUser || !resolvedBook) {
      setMessage("❌ Data missing. Please restart.");
      setStatus(STATUS.ERROR);
      return;
    }

    setStatus(STATUS.LOADING);

    try {
      const url = `${baseURL}/api/admin/borrow`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: currentUser.id, book_id: resolvedBook.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`❌ ${data.message || "Borrow failed"}`);
        setStatus(STATUS.ERROR);
        return;
      }

      setStatus(STATUS.SUCCESS);
      setMessage("✅ Book borrowed successfully!");
    } catch (err) {
      setMessage("❌ Server error. Please try again.");
      setStatus(STATUS.ERROR);
    }
  };

  const handleReset = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setResolvedUser(null);
    setResolvedBook(null);
    setMessage("");
    setWrongScan("");
    setStatus(STATUS.IDLE);
  };

  const activeStep =
    status === STATUS.IDLE         ? 0 :
    status === STATUS.USER_SCANNED ? 1 :
    status === STATUS.REVIEW       ? 2 : 2;

  const steps = [
    { label: "Scan Student", done: !!resolvedUser },
    { label: "Scan Book",    done: !!resolvedBook },
    { label: "Confirm",      done: status === STATUS.SUCCESS },
  ];

  return (
    <>
      <Sidebar />

      <div className="station-page">
        <h2>📖 QR Borrow Station</h2>
        <p className="subtitle">Quick borrow with QR codes</p>

        {/* STEP INDICATOR */}
        <div className="steps">
          {steps.map((s, i) => (
            <div key={i} className={`step ${s.done ? "done" : ""} ${i === activeStep ? "active" : ""}`}>
              <div className="step-circle">{s.done ? "✓" : i + 1}</div>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="scan-card">

          {/* WRONG SCAN WARNING */}
          {wrongScan && (
            <div className="wrong-scan-banner">
              ⚠️ {wrongScan}
            </div>
          )}

          {/* STEP 1 — STUDENT SCANNER */}
          {status === STATUS.IDLE && (
            <div className="scan-section">
              <div className="scan-label">
                <span className="scan-icon">🪪</span>
                <div>
                  <strong>Scan Student QR</strong>
                  <p>Student opens Profile → Show QR</p>
                </div>
              </div>
              <div id="user-reader" className="scanner-box" />
            </div>
          )}

          {/* STUDENT RESOLVED */}
          {resolvedUser && (
            <div className="resolved-box">
              <span className="icon">👤</span>
              <div>
                <strong>{resolvedUser.full_name}</strong>
                <p>LRN: {resolvedUser.lrn || "—"}</p>
              </div>
            </div>
          )}

          {/* STEP 2 — BOOK SCANNER */}
          {status === STATUS.USER_SCANNED && (
            <div className="scan-section" style={{ marginTop: "16px" }}>
              <div className="scan-label">
                <span className="scan-icon">📚</span>
                <div>
                  <strong>Scan Book QR</strong>
                  <p>Scan sticker on book or book detail</p>
                </div>
              </div>
              <div id="book-reader" className="scanner-box" />
            </div>
          )}

          {/* BOOK RESOLVED */}
          {resolvedBook && status !== STATUS.REVIEW && (
            <div className="resolved-box" style={{ marginTop: "10px" }}>
              <span className="icon">📖</span>
              <div>
                <strong>{resolvedBook.title}</strong>
                <p>{resolvedBook.copies ?? 0} available</p>
              </div>
            </div>
          )}

          {/* STEP 3 — REVIEW & CONFIRM */}
          {status === STATUS.REVIEW && (
            <div className="review-section">
              <h3>Review Borrow</h3>

              <div className="review-item">
                <label>Student</label>
                <div className="review-value">
                  <span>👤</span>
                  <strong>{resolvedUser?.full_name}</strong>
                </div>
              </div>

              <div className="review-item">
                <label>Book</label>
                <div className="review-value">
                  <span>📖</span>
                  <strong>{resolvedBook?.title}</strong>
                </div>
              </div>

              <div className="button-group">
                <button
                  className="confirm-btn"
                  onClick={submitBorrow}
                  disabled={status === STATUS.LOADING}
                >
                  {status === STATUS.LOADING ? "Processing..." : "✓ Confirm & Borrow"}
                </button>
                <button
                  className="cancel-btn"
                  onClick={handleReset}
                  disabled={status === STATUS.LOADING}
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {/* LOADING */}
          {status === STATUS.LOADING && (
            <div className="msg loading">⏳ Creating borrow record...</div>
          )}

          {/* RESULT MESSAGE */}
          {message && (
            <div className={`msg ${status === STATUS.SUCCESS ? "success" : "error"}`}>
              {message}
            </div>
          )}

          {/* RESET BUTTON */}
          {(status === STATUS.SUCCESS || status === STATUS.ERROR) && (
            <button className="reset-btn" onClick={handleReset}>
              🔄 New Transaction
            </button>
          )}

        </div>

        {/* INSTRUCTIONS */}
        <div className="instructions">
          <h4>📋 Steps</h4>
          <ol>
            <li>Student opens <strong>Profile</strong></li>
            <li>Scan their QR code</li>
            <li>Scan book QR sticker</li>
            <li>Review and confirm</li>
            <li>Done ✅</li>
          </ol>
        </div>
      </div>

      <BottomNav />

      <style jsx>{`
        .station-page {
          padding: 80px 16px 120px;
          background: #f9fbe7;
          min-height: 100vh;
          font-family: "Poppins", sans-serif;
          max-width: 540px;
          margin: 0 auto;
        }

        h2 {
          text-align: center;
          color: #2e7d32;
          margin: 0 0 6px;
          font-size: 1.4rem;
        }

        .subtitle {
          text-align: center;
          color: #888;
          font-size: 0.85rem;
          margin: 0 0 24px;
        }

        /* ── steps ── */
        .steps {
          display: flex;
          margin-bottom: 24px;
          gap: 0;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex: 1;
          font-size: 0.7rem;
          color: #bbb;
          text-align: center;
          position: relative;
        }

        .step:not(:last-child)::after {
          content: "";
          position: absolute;
          top: 14px;
          right: -50%;
          width: 100%;
          height: 2px;
          background: #ddd;
          z-index: 0;
        }

        .step.done:not(:last-child)::after { background: #66bb6a; }

        .step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #eee;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.75rem;
          z-index: 1;
          position: relative;
        }

        .step.active .step-circle { background: #2e7d32; color: white; }
        .step.done .step-circle   { background: #66bb6a; color: white; }
        .step.active { color: #2e7d32; }
        .step.done   { color: #388e3c; }

        /* ── card ── */
        .scan-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 2px 12px rgba(46, 125, 50, 0.08);
          border: 1px solid #c5e1a5;
          margin-bottom: 20px;
        }

        /* wrong scan warning */
        .wrong-scan-banner {
          background: #fff3e0;
          border: 1.5px solid #ffb74d;
          color: #e65100;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 14px;
          text-align: center;
          animation: slideDown 0.25s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* scan section */
        .scan-section {
          border: 1.5px solid #2e7d32;
          border-radius: 12px;
          padding: 14px;
          background: #f1f8e9;
        }

        .scan-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 12px;
        }

        .scan-icon { font-size: 1.4rem; }
        .scan-label strong { display: block; color: #2e7d32; font-size: 0.9rem; }
        .scan-label p { margin: 0; font-size: 0.78rem; color: #888; }

        .scanner-box {
          width: 100%;
          max-width: 300px;
          margin: 0 auto;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        /* resolved boxes */
        .resolved-box {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #e8f5e9;
          border-radius: 10px;
          padding: 12px 14px;
          border: 1px solid #c5e1a5;
          margin-top: 10px;
        }

        .resolved-box .icon { font-size: 1.6rem; }
        .resolved-box strong { display: block; color: #2e7d32; font-size: 0.9rem; }
        .resolved-box p { margin: 2px 0 0; font-size: 0.78rem; color: #666; }

        /* review section */
        .review-section {
          background: #f1f8e9;
          border-radius: 12px;
          padding: 16px;
          border: 1.5px solid #2e7d32;
        }

        .review-section h3 {
          margin: 0 0 14px;
          color: #2e7d32;
          font-size: 1rem;
          text-align: center;
        }

        .review-item {
          margin-bottom: 12px;
        }

        .review-item label {
          display: block;
          font-size: 0.75rem;
          color: #888;
          margin-bottom: 4px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .review-value {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #ddd;
        }

        .review-value strong {
          color: #2e7d32;
          font-size: 0.9rem;
        }

        .button-group {
          display: flex;
          gap: 8px;
          margin-top: 14px;
        }

        .confirm-btn, .cancel-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .confirm-btn {
          background: #2e7d32;
          color: white;
        }

        .confirm-btn:hover:not(:disabled) { opacity: 0.9; }
        .confirm-btn:disabled { background: #c8e6c9; cursor: not-allowed; }

        .cancel-btn {
          background: #ffcdd2;
          color: #c62828;
        }

        .cancel-btn:hover:not(:disabled) { opacity: 0.9; }
        .cancel-btn:disabled { background: #f5f5f5; color: #ccc; cursor: not-allowed; }

        /* messages */
        .msg {
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 0.88rem;
          margin-top: 12px;
          text-align: center;
          font-weight: 600;
        }

        .msg.success { background: #c8e6c9; color: #2e7d32; }
        .msg.error   { background: #ffcdd2; color: #c62828; }
        .msg.loading { background: #fff9c4; color: #f57f17; }

        .reset-btn {
          width: 100%;
          margin-top: 14px;
          padding: 13px;
          background: #2e7d32;
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: bold;
          font-size: 0.95rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .reset-btn:hover { opacity: 0.9; }

        /* instructions */
        .instructions {
          background: white;
          border-radius: 12px;
          padding: 16px;
          border: 1px solid #dcedc8;
        }

        .instructions h4 {
          color: #2e7d32;
          margin: 0 0 12px;
          font-size: 0.9rem;
        }

        .instructions ol {
          padding-left: 18px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .instructions li {
          font-size: 0.82rem;
          color: #555;
          line-height: 1.4;
        }

        .instructions strong { color: #2e7d32; }
      `}</style>
    </>
  );
}