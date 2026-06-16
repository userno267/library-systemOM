// src/pages/ScanQR.jsx
// Handles three QR types:
//   BOOK:id        → navigate to book detail (existing)
//   ATTENDANCE:... → record time in / time out (new)
//   anything else  → show invalid message

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

export default function ScanQR() {
  const navigate = useNavigate();
  const baseURL  = import.meta.env.VITE_API_URL;
  const token    = localStorage.getItem("token");

  const [attendanceResult, setAttendanceResult] = useState(null);
  // { action: "time_in"|"time_out", message: string, time: string }
  const [attendanceError, setAttendanceError]   = useState(null);
  const [scanning, setScanning]                 = useState(true);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      async (decodedText) => {

        /* ── BOOK QR ── */
        if (decodedText.startsWith("BOOK:")) {
          const bookId = decodedText.split(":")[1];
          scanner.clear().catch(() => {});
          navigate(`/books/${bookId}`);
          return;
        }

        /* ── ATTENDANCE QR ── */
        if (decodedText.startsWith("ATTENDANCE:")) {
          // Stop scanner so it doesn't fire twice
          scanner.clear().catch(() => {});
          setScanning(false);
          setAttendanceResult(null);
          setAttendanceError(null);

          try {
            const res = await fetch(`${baseURL}/api/attendance/scan`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true"
              }
            });

            const data = await res.json();

            if (!res.ok) {
              setAttendanceError(data.message || "Attendance failed");
              return;
            }

            setAttendanceResult(data);
          } catch (err) {
            setAttendanceError("Server error. Please try again.");
          }
          return;
        }

        /* ── INVALID ── */
        setAttendanceError(`Unknown QR code: "${decodedText}"`);
      },
      (error) => {
        console.warn(error);
      }
    );

    return () => scanner.clear().catch(() => {});
  }, [navigate]);

  /* ── reset: start a new scan ── */
  const handleScanAgain = () => {
    setAttendanceResult(null);
    setAttendanceError(null);
    setScanning(true);
    // reload the page to reinitialize the scanner cleanly
    window.location.reload();
  };

  const formatTime = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <Sidebar />

      <div className="scan-page">
        <h2>📷 Scan QR Code</h2>

        {/* ── SCANNER ── */}
        {scanning && (
          <>
            <p className="hint">Scan a book QR or the library attendance QR</p>
            <div id="reader" className="scanner-box" />
          </>
        )}

        {/* ── ATTENDANCE SUCCESS ── */}
        {attendanceResult && (
          <div className={`result-card ${attendanceResult.action}`}>
            <div className="result-icon">
              {attendanceResult.action === "time_in" ? "🟢" : "🔴"}
            </div>
            <h3>
              {attendanceResult.action === "time_in"
                ? "Time In Recorded"
                : "Time Out Recorded"}
            </h3>
            <p className="result-time">{formatTime(attendanceResult.time)}</p>
            <p className="result-msg">{attendanceResult.message}</p>
            <button className="scan-again-btn" onClick={handleScanAgain}>
              🔄 Scan Again
            </button>
          </div>
        )}

        {/* ── ATTENDANCE ERROR ── */}
        {attendanceError && (
          <div className="result-card error">
            <div className="result-icon">⚠️</div>
            <h3>Scan Failed</h3>
            <p className="result-msg">{attendanceError}</p>
            <button className="scan-again-btn" onClick={handleScanAgain}>
              🔄 Try Again
            </button>
          </div>
        )}
      </div>

      <BottomNav />

      <style jsx>{`
        .scan-page {
          padding: 80px 16px 100px;
          background: #f9fbe7;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        h2 {
          font-size: 1.3rem;
          margin-bottom: 6px;
          text-align: center;
          color: #2e7d32;
        }

        .hint {
          font-size: 0.82rem;
          color: #888;
          margin-bottom: 20px;
          text-align: center;
        }

        .scanner-box {
          width: 90vw;
          max-width: 320px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        /* ── result card ── */
        .result-card {
          background: white;
          border-radius: 20px;
          padding: 32px 24px;
          text-align: center;
          width: 90vw;
          max-width: 320px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          border: 2px solid #c5e1a5;
          margin-top: 20px;
        }

        .result-card.time_in  { border-color: #66bb6a; }
        .result-card.time_out { border-color: #ef5350; }
        .result-card.error    { border-color: #ffcc02; }

        .result-icon {
          font-size: 3rem;
          margin-bottom: 12px;
        }

        .result-card h3 {
          color: #2e7d32;
          margin: 0 0 8px;
          font-size: 1.2rem;
        }

        .result-card.time_out h3 { color: #c62828; }
        .result-card.error h3    { color: #f57f17; }

        .result-time {
          font-size: 2rem;
          font-weight: 700;
          color: #2e7d32;
          margin: 0 0 6px;
        }

        .result-card.time_out .result-time { color: #c62828; }

        .result-msg {
          font-size: 0.85rem;
          color: #666;
          margin: 0 0 20px;
        }

        .scan-again-btn {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 12px 28px;
          border-radius: 10px;
          font-weight: bold;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .scan-again-btn:hover { opacity: 0.9; }
      `}</style>
    </>
  );
}