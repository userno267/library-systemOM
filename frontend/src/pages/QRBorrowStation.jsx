import { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

const STATUS = {
  IDLE:         "idle",
  USER_SCANNED: "user_scanned",
  LOADING:      "loading",
  SUCCESS:      "success",
  ERROR:        "error",
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
  const [wrongScan, setWrongScan]       = useState(""); // inline warning, non-blocking
  const [debugLog, setDebugLog]         = useState([]);

  const scannerRef      = useRef(null);
  const resolvedUserRef = useRef(null);

  useEffect(() => { resolvedUserRef.current = resolvedUser; }, [resolvedUser]);

  const log = (msg) =>
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} › ${String(msg)}`]);

  // =====================================================
  // Starts a scanner on a given div
  // expectedPrefix: "USER:" or "BOOK:" — rejects anything else
  // with an inline warning and restarts the scanner
  // =====================================================
  const startScanner = (divId, expectedPrefix, onSuccess) => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }

    const scanner = new Html5QrcodeScanner(divId, { fps: 10, qrbox: 220 }, false);

    scanner.render(
      (decodedText) => {
        // Wrong QR type scanned
        if (!decodedText.startsWith(expectedPrefix)) {
          const expected = expectedPrefix === "USER:" ? "student" : "book";
          const got      = decodedText.startsWith("USER:") ? "student"
                         : decodedText.startsWith("BOOK:") ? "book"
                         : "unknown";

          log(`❌ Wrong QR — expected ${expectedPrefix}, got: "${decodedText}"`);
          setWrongScan(`Wrong QR scanned — that's a ${got} code. Please scan a ${expected} QR.`);

          // Restart the same scanner after a short delay
          // so the admin can try again without losing progress
          setTimeout(() => {
            setWrongScan("");
            startScanner(divId, expectedPrefix, onSuccess);
          }, 2500);

          return; // do NOT advance state
        }

        // Correct QR type — proceed
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

  // Start student scanner on idle
  useEffect(() => {
    if (status === STATUS.IDLE) {
      log("Scanner started — waiting for student QR...");
      setTimeout(() => startScanner("user-reader", "USER:", handleUserScanned), 300);
    }
  }, [status]);

  // Start book scanner after student resolved
  useEffect(() => {
    if (status === STATUS.USER_SCANNED) {
      log("Student resolved — waiting for book QR...");
      setTimeout(() => startScanner("book-reader", "BOOK:", handleBookScanned), 300);
    }
  }, [status]);

  // =====================================================
  // Step 1: Student QR scanned (already validated USER: prefix)
  // =====================================================
  const handleUserScanned = async (raw) => {
    log("RAW SCAN: " + raw);

    const userId = raw.split(":")[1];
    log("Parsed user ID: " + userId);

    if (!userId || isNaN(userId)) {
      log("❌ Invalid user ID value");
      setMessage(`❌ Could not parse ID from: "${raw}"`);
      setStatus(STATUS.ERROR);
      return;
    }

    try {
      const url = `${baseURL}/api/users/admin/${userId}`;
      log("Fetching: " + url);

      const res  = await fetch(url, { headers });
      const data = await res.json();
      log("Response: " + JSON.stringify(data));

      if (!res.ok) throw new Error(data.message || "HTTP " + res.status);

      setResolvedUser(data);
      log("✅ Student found: " + data.full_name);
      setMessage("");
      setStatus(STATUS.USER_SCANNED);
    } catch (err) {
      log("❌ Fetch error: " + err.message);
      setMessage(`❌ Error: ${err.message}`);
      setStatus(STATUS.ERROR);
    }
  };

  // =====================================================
  // Step 2: Book QR scanned (already validated BOOK: prefix)
  // =====================================================
  const handleBookScanned = async (raw) => {
    log("RAW SCAN: " + raw);

    const bookId = raw.split(":")[1];
    log("Parsed book ID: " + bookId);

    if (!bookId || isNaN(bookId)) {
      log("❌ Invalid book ID value");
      setMessage(`❌ Could not parse ID from: "${raw}"`);
      setStatus(STATUS.ERROR);
      return;
    }

    try {
      const url  = `${baseURL}/api/books/${bookId}`;
      log("Fetching: " + url);

      const res  = await fetch(url, { headers });
      const data = await res.json();
      log("Response: " + JSON.stringify(data));

      if (!res.ok) throw new Error(data.message || "HTTP " + res.status);

      setResolvedBook(data);
      log("✅ Book found: " + data.title);

      const currentUser = resolvedUserRef.current;
      if (!currentUser) {
        log("❌ resolvedUser is null — lost student ref");
        setMessage("❌ Student lost. Please restart.");
        setStatus(STATUS.ERROR);
        return;
      }

      log("Submitting borrow: user=" + currentUser.id + " book=" + data.id);
      await submitBorrow(currentUser.id, data.id);
    } catch (err) {
      log("❌ Fetch error: " + err.message);
      setMessage(`❌ Error: ${err.message}`);
      setStatus(STATUS.ERROR);
    }
  };

  // =====================================================
  // Submit borrow to backend
  // =====================================================
  const submitBorrow = async (userId, bookId) => {
    setStatus(STATUS.LOADING);
    try {
      const url = `${baseURL}/api/admin/borrow`;
      log("POST " + url);

      const res  = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: userId, book_id: bookId }),
      });
      const data = await res.json();
      log("Borrow response: " + JSON.stringify(data));

      if (!res.ok) {
        setMessage(`❌ ${data.message || "Borrow failed"}`);
        setStatus(STATUS.ERROR);
        return;
      }

      setStatus(STATUS.SUCCESS);
      setMessage("✅ Book borrowed successfully!");
      log("✅ Borrow created successfully");
    } catch (err) {
      log("❌ Borrow error: " + err.message);
      setMessage("❌ Server error. Please try again.");
      setStatus(STATUS.ERROR);
    }
  };

  // =====================================================
  // Reset everything
  // =====================================================
  const handleReset = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setResolvedUser(null);
    setResolvedBook(null);
    setMessage("");
    setWrongScan("");
    setDebugLog([]);
    setStatus(STATUS.IDLE);
  };

  const activeStep =
    status === STATUS.IDLE         ? 0 :
    status === STATUS.USER_SCANNED ? 1 : 2;

  const steps = [
    { label: "Scan Student QR", done: !!resolvedUser },
    { label: "Scan Book QR",    done: !!resolvedBook },
    { label: "Confirm Borrow",  done: status === STATUS.SUCCESS },
  ];

  return (
    <>
      <Sidebar />

      <div className="station-page">
        <h2>📷 QR Borrow Station</h2>
        <p className="subtitle">Scan student QR then book QR to borrow</p>

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

          {/* WRONG SCAN WARNING — non-blocking, auto-dismisses */}
          {wrongScan && (
            <div className="wrong-scan-banner">
              ⚠️ {wrongScan}
            </div>
          )}

          {/* STEP 1 — student camera */}
          {status === STATUS.IDLE && (
            <div className="scan-section">
              <div className="scan-label">
                <span className="scan-icon">🪪</span>
                <div>
                  <strong>Step 1 — Scan Student QR</strong>
                  <p>Student opens Profile and shows their QR code</p>
                </div>
              </div>
              <div id="user-reader" className="scanner-box" />
            </div>
          )}

          {/* Student resolved */}
          {resolvedUser && (
            <div className="resolved-box">
              <span>✅</span>
              <div>
                <strong>{resolvedUser.full_name}</strong>
                <p>LRN: {resolvedUser.lrn || "—"}</p>
              </div>
            </div>
          )}

          {/* STEP 2 — book camera */}
          {status === STATUS.USER_SCANNED && (
            <div className="scan-section" style={{ marginTop: "16px" }}>
              <div className="scan-label">
                <span className="scan-icon">📚</span>
                <div>
                  <strong>Step 2 — Scan Book QR</strong>
                  <p>Scan the QR sticker on the book</p>
                </div>
              </div>
              <div id="book-reader" className="scanner-box" />
            </div>
          )}

          {/* Book resolved */}
          {resolvedBook && (
            <div className="resolved-box" style={{ marginTop: "10px" }}>
              <span>✅</span>
              <div>
                <strong>{resolvedBook.title}</strong>
                <p>Copies: {resolvedBook.copies ?? "—"}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {status === STATUS.LOADING && (
            <div className="msg info">⏳ Creating borrow record...</div>
          )}

          {/* Message */}
          {message && (
            <div className={`msg ${status === STATUS.SUCCESS ? "success" : "error"}`}>
              {message}
            </div>
          )}

          {/* Reset */}
          {(status === STATUS.SUCCESS || status === STATUS.ERROR) && (
            <button className="reset-btn" onClick={handleReset}>
              🔄 New Transaction
            </button>
          )}

          {/* DEBUG BOX */}
          {debugLog.length > 0 && (
            <div className="debug-box">
              <div className="debug-header">
                🐛 Debug Log
                <button className="debug-clear" onClick={() => setDebugLog([])}>clear</button>
              </div>
              {debugLog.map((line, i) => (
                <div key={i} className="debug-line">{line}</div>
              ))}
            </div>
          )}

        </div>

        {/* INSTRUCTIONS */}
        <div className="instructions">
          <h4>📋 How to use</h4>
          <ol>
            <li>Student opens <strong>Profile</strong> and shows their QR</li>
            <li>Point camera at student QR — auto detected</li>
            <li>Point camera at book QR sticker</li>
            <li>Borrow created automatically ✅</li>
          </ol>
          <p className="hint">⚠️ Wrong QR type will be rejected automatically — no need to restart</p>
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

        h2 { text-align: center; color: #2e7d32; margin-bottom: 4px; }

        .subtitle {
          text-align: center; color: #888;
          font-size: 0.85rem; margin-bottom: 24px;
        }

        .steps { display: flex; margin-bottom: 24px; }

        .step {
          display: flex; flex-direction: column;
          align-items: center; gap: 4px; flex: 1;
          font-size: 0.72rem; color: #bbb;
          text-align: center; position: relative;
        }

        .step:not(:last-child)::after {
          content: ""; position: absolute;
          top: 14px; right: -50%;
          width: 100%; height: 2px;
          background: #ddd; z-index: 0;
        }

        .step.done:not(:last-child)::after { background: #66bb6a; }

        .step-circle {
          width: 28px; height: 28px; border-radius: 50%;
          background: #eee; display: flex;
          align-items: center; justify-content: center;
          font-weight: bold; font-size: 0.8rem;
          z-index: 1; position: relative;
        }

        .step.active .step-circle { background: #2e7d32; color: white; }
        .step.done   .step-circle { background: #66bb6a; color: white; }
        .step.active { color: #2e7d32; }
        .step.done   { color: #388e3c; }

        .scan-card {
          background: white; border-radius: 16px; padding: 20px;
          box-shadow: 0 2px 12px rgba(46,125,50,0.08);
          border: 1px solid #c5e1a5; margin-bottom: 20px;
        }

        /* Non-blocking wrong scan warning */
        .wrong-scan-banner {
          background: #fff3e0;
          border: 1.5px solid #ffb74d;
          color: #e65100;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 12px;
          text-align: center;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .scan-section {
          border: 1.5px solid #2e7d32;
          border-radius: 12px; padding: 14px; background: #f1f8e9;
        }

        .scan-label {
          display: flex; align-items: flex-start;
          gap: 10px; margin-bottom: 12px;
        }

        .scan-icon { font-size: 1.4rem; }
        .scan-label strong { display: block; color: #2e7d32; font-size: 0.9rem; }
        .scan-label p { margin: 0; font-size: 0.78rem; color: #888; }

        .scanner-box {
          width: 100%; max-width: 300px;
          margin: 0 auto; border-radius: 12px;
          overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .resolved-box {
          display: flex; align-items: center; gap: 12px;
          background: #e8f5e9; border-radius: 10px;
          padding: 12px 14px; border: 1px solid #c5e1a5;
        }

        .resolved-box span { font-size: 1.3rem; }
        .resolved-box strong { display: block; color: #2e7d32; font-size: 0.9rem; }
        .resolved-box p { margin: 2px 0 0; font-size: 0.78rem; color: #666; }

        .msg {
          padding: 10px 14px; border-radius: 8px;
          font-size: 0.88rem; margin-top: 12px; text-align: center;
        }

        .success { background: #c8e6c9; color: #2e7d32; font-weight: 600; }
        .error   { background: #ffcdd2; color: #c62828; }
        .info    { background: #fff9c4; color: #f57f17; }

        .reset-btn {
          width: 100%; margin-top: 16px; padding: 13px;
          background: #2e7d32; color: white; border: none;
          border-radius: 10px; font-weight: bold;
          font-size: 0.95rem; cursor: pointer;
        }

        .reset-btn:hover { opacity: 0.9; }

        .debug-box {
          margin-top: 16px;
          background: #1a1a2e;
          border-radius: 10px;
          padding: 12px;
          max-height: 260px;
          overflow-y: auto;
        }

        .debug-header {
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .debug-clear {
          background: #444;
          color: #ccc;
          border: none;
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 0.7rem;
          cursor: pointer;
        }

        .debug-line {
          font-family: monospace;
          font-size: 0.7rem;
          color: #00e676;
          padding: 2px 0;
          border-bottom: 1px solid #2a2a4a;
          word-break: break-all;
          line-height: 1.5;
        }

        .instructions {
          background: white; border-radius: 12px;
          padding: 16px; border: 1px solid #dcedc8;
        }

        .instructions h4 { color: #2e7d32; margin: 0 0 10px; font-size: 0.9rem; }
        .instructions ol { padding-left: 18px; margin: 0 0 10px; }
        .instructions li { font-size: 0.82rem; color: #555; margin-bottom: 6px; line-height: 1.5; }

        .hint {
          font-size: 0.78rem; color: #e65100;
          background: #fff3e0; border-radius: 8px;
          padding: 8px 12px; margin: 0;
        }
      `}</style>
    </>
  );
}