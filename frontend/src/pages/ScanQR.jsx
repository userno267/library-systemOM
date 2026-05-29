import { useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

export default function ScanQR() {
  const navigate = useNavigate();

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (decodedText) => {
        if (decodedText.startsWith("BOOK:")) {
          const bookId = decodedText.split(":")[1];
          navigate(`/books/${bookId}`);
        } else {
          alert("Invalid QR Code");
        }
      },
      (error) => {
        console.warn(error);
      }
    );

    return () => scanner.clear();
  }, [navigate]);

  return (
    <>
      <Sidebar />

      <div className="scan-page">
        <h2>📷 Scan Book QR Code</h2>
        <div id="reader" className="scanner-box"></div>
      </div>

      <BottomNav />

      <style jsx>{`
        .scan-page {
          padding: 80px 16px 100px; /* match BookDetail padding for header/footer */
          background: #f9fbe7;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        h2 {
          font-size: 1.3rem;
          margin-bottom: 20px;
          text-align: center;
        }

        .scanner-box {
          width: 90vw;
          max-width: 320px;
          aspect-ratio: 1 / 1;
          border-radius: 16px;
          overflow: show;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
      `}</style>
    </>
  );
}