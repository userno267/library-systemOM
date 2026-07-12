import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminFineManagement() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const baseURL = import.meta.env.VITE_API_URL;

  const [user, setUser] = useState(null);
  const [fines, setFines] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [borrows, setBorrows] = useState([]);

  // manual fine form
  const [form, setForm] = useState({
    fine_type: "lost",
    amount: "",
    notes: "",
    borrow_id: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const headers = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true",
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [userRes, finesRes, borrowsRes] = await Promise.all([
        fetch(`${baseURL}/api/users/admin/${userId}`, { headers }),
        fetch(`${baseURL}/api/fines/user/${userId}`, { headers }),
        fetch(`${baseURL}/api/borrows/history/${userId}`, { headers }),
      ]);

      const userData = await userRes.json();
      const finesData = await finesRes.json();
      const borrowsData = await borrowsRes.json();

      setUser(userData);
      setFines(finesData.fines || []);
      setTotalUnpaid(finesData.totalUnpaid || 0);
      setBorrows(Array.isArray(borrowsData) ? borrowsData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [userId]);

 const handlePay = async (fineId, amountPaid) => {
  try {
    const res = await fetch(`${baseURL}/api/fines/${fineId}/pay`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaid })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("Pay fine failed:", res.status, errData);
      throw new Error(errData.message || `Request failed with status ${res.status}`);
    }

    await fetchAll();
    setTimeout(() => window.open(`/receipt/${fineId}`, "_blank"), 500);
  } catch (err) {
    console.error("handlePay error:", err);
    alert(`Failed to process payment: ${err.message}`);
  }
};
  const handleWaive = async (fineId) => {
    if (!confirm("Waive this fine?")) return;
    try {
      const res = await fetch(`${baseURL}/api/fines/${fineId}/waive`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error();
      fetchAll();
    } catch {
      alert("Failed to waive fine");
    }
  };

  const handleAddFine = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      return alert("Please enter a valid amount");
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${baseURL}/api/fines/user/${userId}/add`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          fine_type: form.fine_type,
          amount: Number(form.amount),
          notes: form.notes || null,
          borrow_id: form.borrow_id || null,
        }),
      });
      if (!res.ok) throw new Error();
      setForm({ fine_type: "lost", amount: "", notes: "", borrow_id: "" });
      fetchAll();
    } catch {
      alert("Failed to add fine");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status) => {
    if (status === "paid") return "badge-paid";
    if (status === "waived") return "badge-waived";
    return "badge-unpaid";
  };

  if (loading) return (
    <>
      <AdminSidebar />
      <div className="admin-main center">Loading...</div>
    </>
  );

  return (
    <>
      <AdminSidebar />
      <div className="admin-main">

        <button className="back-btn" onClick={() => navigate(-1)}>⬅ Back</button>

        {/* USER HEADER */}
        <div className="user-header">
          <div>
            <h1>{user?.full_name}</h1>
            <p>LRN: {user?.lrn} · {user?.email}</p>
          </div>
          <div className={`total-fine ${totalUnpaid > 0 ? "has-fine" : "no-fine"}`}>
            <span>Total Unpaid</span>
            <strong>₱{Number(totalUnpaid).toFixed(2)}</strong>
          </div>
        </div>

        {/* ADD MANUAL FINE */}
        <div className="card">
          <h2>Add Manual Charge</h2>
          <form onSubmit={handleAddFine} className="fine-form">
            <div className="form-row">
              <div className="field">
                <label>Type</label>
                <select value={form.fine_type} onChange={(e) => setForm({ ...form, fine_type: e.target.value })}>
                  <option value="lost">Lost Book</option>
                  <option value="damaged">Damaged Book</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="field">
                <label>Amount (₱)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Linked Borrow (optional)</label>
                <select value={form.borrow_id} onChange={(e) => setForm({ ...form, borrow_id: e.target.value })}>
                  <option value="">— None —</option>
                  {borrows.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({new Date(b.borrowed_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Notes / Reason</label>
              <input
                type="text"
                placeholder="e.g. Cover torn, pages missing..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <button type="submit" className="add-btn" disabled={submitting}>
              {submitting ? "Adding..." : "➕ Add Charge"}
            </button>
          </form>
        </div>

        {/* FINES TABLE */}
        <div className="card">
          <h2>Fine History</h2>
          {fines.length === 0 ? (
            <p className="center">No fines on record.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Book</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Paid At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fines.map((fine) => (
                  <tr key={fine.id}>
                    <td><span className="type-badge">{fine.fine_type}</span></td>
                    <td>{fine.book_title || "—"}</td>
                    <td>₱{Number(fine.amount).toFixed(2)}</td>
                    <td>{fine.notes || "—"}</td>
                    <td><span className={`badge ${statusColor(fine.status)}`}>{fine.status}</span></td>
                    <td>{new Date(fine.created_at).toLocaleDateString()}</td>
                    <td>{fine.paid_at ? new Date(fine.paid_at).toLocaleDateString() : "—"}</td>
                    <td className="actions">
                      {fine.status === "unpaid" && (
                        <>
                          <button className="pay-btn" onClick={() => handlePay(fine.id)}>✔ Pay</button>
                          <button className="waive-btn" onClick={() => handleWaive(fine.id)}>✦ Waive</button>
                        </>
                      )}
                      {fine.status !== "unpaid" && <span className="resolved">Resolved</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .admin-main { margin-left: 260px; padding: 30px; background: #f9fbe7; min-height: 100vh; }
        .center { text-align: center; color: #777; padding-top: 50px; }
        .back-btn { background: #2e7d32; color: white; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; margin-bottom: 20px; }
        .user-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px; border-radius: 12px; border: 1px solid #c5e1a5; margin-bottom: 20px; }
        .user-header h1 { margin: 0; color: #2e7d32; }
        .user-header p { margin: 4px 0 0; color: #666; }
        .total-fine { text-align: right; display: flex; flex-direction: column; }
        .total-fine span { font-size: 0.85rem; color: #666; }
        .total-fine strong { font-size: 1.6rem; font-weight: 700; }
        .has-fine strong { color: #c62828; }
        .no-fine strong { color: #2e7d32; }
        .card { background: white; border: 1px solid #c5e1a5; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .card h2 { color: #2e7d32; margin: 0 0 16px; }
        .fine-form { display: flex; flex-direction: column; gap: 12px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 0.85rem; font-weight: 600; color: #4e342e; }
        input, select { padding: 10px; border-radius: 8px; border: 1px solid #c5e1a5; font-size: 0.95rem; }
        .add-btn { background: #2e7d32; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; align-self: flex-start; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #e8f5e9; color: #1b5e20; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
        tr:hover { background: #f1f8e9; }
        .actions { display: flex; gap: 6px; }
        .pay-btn { background: #2e7d32; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 600; }
        .waive-btn { background: #f57f17; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 600; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: capitalize; }
        .badge-unpaid { background: #ffebee; color: #c62828; }
        .badge-paid { background: #e8f5e9; color: #2e7d32; }
        .badge-waived { background: #fff3e0; color: #e65100; }
        .type-badge { background: #e3f2fd; color: #0d47a1; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
        .resolved { color: #aaa; font-size: 0.85rem; }
        button:hover { opacity: 0.9; cursor: pointer; }
      `}</style>
    </>
  );
}