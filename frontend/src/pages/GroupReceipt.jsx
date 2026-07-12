import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

export default function GroupReceipt() {
  const { groupId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const baseURL = import.meta.env.VITE_API_URL;
  const printRef = useRef();

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await fetch(`${baseURL}/api/fines/receipt/group/${groupId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [groupId]);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const printContents = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>Receipt-${groupId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
            .receipt { max-width: 500px; margin: 0 auto; border: 1px solid #ccc; padding: 30px; border-radius: 8px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 16px; }
            .header h2 { margin: 0; font-size: 1.1rem; }
            .header p { margin: 4px 0; font-size: 0.85rem; color: #444; }
            .receipt-no { text-align: center; font-size: 0.9rem; color: #555; margin-bottom: 16px; }
            .section { margin-bottom: 14px; }
            .section h3 { font-size: 0.8rem; text-transform: uppercase; color: #888; margin: 0 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            .row { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px; }
            .row span:last-child { font-weight: bold; }
            .status-paid { color: #2e7d32; font-weight: bold; }
            .status-waived { color: #e65100; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th { text-align: left; font-size: 0.75rem; text-transform: uppercase; color: #888; padding: 6px 0; border-bottom: 1px solid #eee; }
            td { padding: 6px 0; font-size: 0.85rem; border-bottom: 1px solid #f1f1f1; }
            .total-row { border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; font-size: 1rem; }
            .footer { text-align: center; font-size: 0.75rem; color: #888; margin-top: 20px; border-top: 1px solid #eee; padding-top: 12px; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  if (loading) return <div className="loading">Loading receipt...</div>;
  if (!data || !data.fines || data.fines.length === 0) {
    return <div className="loading">Receipt not found.</div>;
  }

  const { fines, totalAmount } = data;
  const first = fines[0];
  const totalPaid = fines.reduce((sum, f) => sum + Number(f.amount_paid || f.amount), 0);
  const totalChange = fines.reduce((sum, f) => sum + Number(f.change_amount || 0), 0);
  const statusClass = first.status === "paid" ? "status-paid" : "status-waived";
  const receiptNo = `RCP-G-${groupId.slice(0, 8).toUpperCase()}`;

  return (
    <div className="page">
      {/* ACTION BUTTONS — hidden on print */}
      <div className="no-print actions-bar">
        <button onClick={handlePrint}>🖨️ Print</button>
        <button onClick={handleDownload}>⬇️ Download</button>
      </div>

      {/* RECEIPT */}
      <div className="receipt" ref={printRef}>
        {/* HEADER */}
        <div className="header">
          <img src="/278737963_102029019168954_7338134888722766049_n.jpg" alt="Logo" className="logo" />
          <h2>Oriental Mindoro National High School</h2>
          <p>Library Management System</p>
          <p>Official Fine Receipt</p>
        </div>

        <div className="receipt-no">
          Receipt No: <strong>{receiptNo}</strong>
        </div>

        {/* STUDENT INFO */}
        <div className="section">
          <h3>Student Information</h3>
          <div className="row"><span>Name</span><span>{first.student_name}</span></div>
          <div className="row"><span>LRN</span><span>{first.student_lrn}</span></div>
          <div className="row"><span>Email</span><span>{first.student_email}</span></div>
        </div>

        {/* FINES INCLUDED */}
        <div className="section">
          <h3>Fines Included ({fines.length})</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Book</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {fines.map((f) => (
                <tr key={f.id}>
                  <td>#{f.id}</td>
                  <td style={{ textTransform: "capitalize" }}>{f.fine_type}</td>
                  <td>{f.book_title || "—"}</td>
                  <td style={{ textAlign: "right" }}>₱{Number(f.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TRANSACTION */}
        <div className="section">
          <h3>Transaction</h3>
          <div className="row">
            <span>Status</span>
            <span className={statusClass}>{first.status.toUpperCase()}</span>
          </div>
          <div className="row">
            <span>Processed By</span>
            <span>{first.processed_by_name || "—"}</span>
          </div>
          <div className="row">
            <span>Date Processed</span>
            <span>{first.paid_at ? new Date(first.paid_at).toLocaleString() : "—"}</span>
          </div>
        </div>

        {/* PAYMENT DETAILS */}
        <div className="section">
          <h3>Payment Details</h3>
          <div className="row">
            <span>Total Fine Amount</span>
            <span>₱{Number(totalAmount).toFixed(2)}</span>
          </div>
          <div className="row">
            <span>Amount Paid</span>
            <span>₱{totalPaid.toFixed(2)}</span>
          </div>
          {totalChange > 0 && (
            <div className="row" style={{ color: "#2e7d32", fontWeight: "bold" }}>
              <span>Change</span>
              <span>₱{totalChange.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="footer">
          <p>This is an official receipt from the OMNHS Library.</p>
          <p>Keep this receipt for your records.</p>
          <p>Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .page { padding: 0; background: white; }
          .receipt { box-shadow: none; border: 1px solid #ccc; }
        }

        body { margin: 0; background: #f5f5f5; }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: Arial, sans-serif;
          color: #666;
        }

        .page {
          min-height: 100vh;
          background: #f5f5f5;
          padding: 30px 20px;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .actions-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .actions-bar button {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          background: #2e7d32;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 0.95rem;
        }

        .actions-bar button:hover { opacity: 0.9; }

        .receipt {
          background: white;
          max-width: 500px;
          width: 100%;
          padding: 36px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #1b5e20;
          padding-bottom: 16px;
          margin-bottom: 16px;
        }

        .logo {
          width: 64px;
          height: 64px;
          object-fit: contain;
          margin-bottom: 8px;
        }

        .header h2 {
          margin: 0;
          font-size: 1rem;
          color: #1b5e20;
        }

        .header p {
          margin: 3px 0;
          font-size: 0.82rem;
          color: #555;
        }

        .receipt-no {
          text-align: center;
          font-size: 0.88rem;
          color: #555;
          margin-bottom: 20px;
          background: #f9fbe7;
          padding: 8px;
          border-radius: 6px;
        }

        .section {
          margin-bottom: 18px;
        }

        .section h3 {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #888;
          margin: 0 0 10px;
          border-bottom: 1px solid #eee;
          padding-bottom: 6px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          margin-bottom: 8px;
          color: #333;
        }

        .row span:first-child { color: #666; }
        .row span:last-child { font-weight: 600; text-align: right; max-width: 60%; }

        .status-paid { color: #2e7d32; font-weight: 700; }
        .status-waived { color: #e65100; font-weight: 700; }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          font-size: 0.72rem;
          text-transform: uppercase;
          color: #888;
          padding: 6px 4px;
          border-bottom: 1px solid #eee;
        }

        td {
          padding: 8px 4px;
          font-size: 0.85rem;
          color: #333;
          border-bottom: 1px solid #f5f5f5;
        }

        .total-row {
          border-top: 2px solid #1b5e20;
          margin-top: 12px;
          padding-top: 12px;
          font-size: 1rem;
        }

        .footer {
          text-align: center;
          font-size: 0.75rem;
          color: #999;
          margin-top: 20px;
          border-top: 1px solid #eee;
          padding-top: 14px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}