import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import { AuthContext } from "../context/AuthContext";

export default function TransactionsPage() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const baseURL = import.meta.env.VITE_API_URL;

  const [fines, setFines] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [loading, setLoading] = useState(true);

  // filters
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchFines = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`${baseURL}/api/fines/my?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      const data = await res.json();
      setFines(data.fines || []);
      setTotalUnpaid(data.totalUnpaid || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFines(); }, [statusFilter, startDate, endDate]);

  const statusBadge = (status) => {
    if (status === "paid") return "badge-paid";
    if (status === "waived") return "badge-waived";
    return "badge-unpaid";
  };

  const goToReceipt = (fine) => {
    navigate(
      fine.payment_group_id
        ? `/receipt/group/${fine.payment_group_id}`
        : `/receipt/${fine.id}`
    );
  };

  return (
    <>
      <Sidebar />

      <div className="main">
        <h1>My Transactions</h1>

        {/* UNPAID BALANCE */}
        {totalUnpaid > 0 && (
          <div className="alert-box">
            ⚠️ You have <strong>₱{Number(totalUnpaid).toFixed(2)}</strong> in unpaid fines.
            You cannot borrow books until your balance is cleared.
          </div>
        )}

        {/* FILTERS */}
        <div className="filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="From"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="To"
          />

          <button className="clear-btn" onClick={() => {
            setStatusFilter("");
            setStartDate("");
            setEndDate("");
          }}>
            Clear
          </button>
        </div>

        {/* LIST */}
        {loading ? (
          <p className="center">Loading...</p>
        ) : fines.length === 0 ? (
          <p className="center">No transactions found.</p>
        ) : (
          <div className="fine-list">
            {fines.map((fine) => (
              <div key={fine.id} className="fine-card">
                <div className="fine-top">
                  <div>
                    <span className="fine-type">{fine.fine_type}</span>
                    {fine.book_title && <p className="fine-book">{fine.book_title}</p>}
                    {fine.notes && <p className="fine-notes">{fine.notes}</p>}
                  </div>
                  <div className="fine-right">
                    <strong className="fine-amount">₱{Number(fine.amount).toFixed(2)}</strong>
                    <span className={`badge ${statusBadge(fine.status)}`}>{fine.status}</span>
                  </div>
                </div>

                <div className="fine-meta">
                  <span>Added: {new Date(fine.created_at).toLocaleDateString()}</span>
                  {fine.paid_at && (
                    <span>Resolved: {new Date(fine.paid_at).toLocaleDateString()}</span>
                  )}
                  {fine.processed_by_name && (
                    <span>By: {fine.processed_by_name}</span>
                  )}
                  {fine.payment_group_id && (
                    <span>Grouped payment</span>
                  )}
                </div>

                {fine.status !== "unpaid" && (
                  <button
                    className="receipt-btn"
                    onClick={() => goToReceipt(fine)}
                  >
                    🧾 View Receipt
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      <style>{`
        .main {
          padding: 80px 16px 100px;
          background: #f9fbe7;
          min-height: 100vh;
          font-family: "Poppins", sans-serif;
        }

        h1 {
          text-align: center;
          color: #2e7d32;
          margin-bottom: 15px;
        }

        .alert-box {
          background: #ffebee;
          border: 1px solid #ef9a9a;
          color: #c62828;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .filters {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        select, input[type="date"] {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
          background: white;
          font-size: 0.9rem;
          flex: 1;
          min-width: 120px;
        }

        .clear-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: none;
          background: #eee;
          color: #444;
          font-weight: 600;
        }

        .fine-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .fine-card {
          background: white;
          border-radius: 12px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        }

        .fine-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .fine-type {
          background: #e3f2fd;
          color: #0d47a1;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .fine-book {
          margin: 6px 0 2px;
          font-weight: 600;
          color: #1b5e20;
          font-size: 0.9rem;
        }

        .fine-notes {
          margin: 0;
          font-size: 0.8rem;
          color: #666;
        }

        .fine-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .fine-amount {
          font-size: 1.1rem;
          color: #c62828;
        }

        .badge {
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .badge-unpaid { background: #ffebee; color: #c62828; }
        .badge-paid { background: #e8f5e9; color: #2e7d32; }
        .badge-waived { background: #fff3e0; color: #e65100; }

        .fine-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 0.78rem;
          color: #888;
          margin-bottom: 10px;
        }

        .receipt-btn {
          width: 100%;
          padding: 8px;
          border: none;
          border-radius: 8px;
          background: #e8f5e9;
          color: #2e7d32;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .center { text-align: center; color: #777; margin-top: 30px; }
        button:hover { opacity: 0.9; cursor: pointer; }
      `}</style>
    </>
  );
}