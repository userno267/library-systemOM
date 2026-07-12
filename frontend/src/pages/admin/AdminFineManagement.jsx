import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";

const PAGE_SIZE = 8;

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

  // search + pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // manual fine form
  const [form, setForm] = useState({
    fine_type: "lost",
    amount: "",
    notes: "",
    borrow_id: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // pay all modal
  const [payAllModal, setPayAllModal] = useState(false);
  const [payAllAmount, setPayAllAmount] = useState("");

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

      if (!userRes.ok) console.error("userRes failed:", await userRes.text());
      if (!finesRes.ok) console.error("finesRes failed:", await finesRes.text());
      if (!borrowsRes.ok) console.error("borrowsRes failed:", await borrowsRes.text());

      const userData = await userRes.json();
      const finesData = await finesRes.json();
      const borrowsData = await borrowsRes.json();

      setUser(userData);
      setFines(finesData.fines || []);
      setTotalUnpaid(finesData.totalUnpaid || 0);
      setBorrows(Array.isArray(borrowsData) ? borrowsData : []);
    } catch (err) {
      console.error("fetchAll ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [userId]);

  // reset to page 1 whenever the search term changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const handlePay = async (fineId, amountPaid) => {
    try {
      const res = await fetch(`${baseURL}/api/fines/${fineId}/pay`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Request failed with status ${res.status}`);
      }
      await fetchAll();
      setTimeout(() => window.open(`/receipt/${fineId}`, "_blank"), 500);
    } catch (err) {
      console.error("handlePay error:", err);
      alert(`Failed to process payment: ${err.message}`);
    }
  };

  const openPayAllModal = () => {
    const unpaidFines = fines.filter((f) => f.status === "unpaid");
    if (unpaidFines.length === 0) return;
    const total = unpaidFines.reduce((sum, f) => sum + Number(f.amount), 0);
    setPayAllAmount(total.toFixed(2));
    setPayAllModal(true);
  };

  const confirmPayAll = async () => {
    const unpaidFines = fines.filter((f) => f.status === "unpaid");
    const fineIds = unpaidFines.map((f) => f.id);
    const amount = Number(payAllAmount);

    if (!amount || amount <= 0) return alert("Enter a valid amount");

    setSubmitting(true);
    try {
      const res = await fetch(`${baseURL}/api/fines/pay-multiple`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fineIds, amountPaid: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to pay fines");

      setPayAllModal(false);
      await fetchAll();
      setTimeout(() => window.open(`/receipt/group/${data.groupId}`, "_blank"), 500);
    } catch (err) {
      console.error("confirmPayAll error:", err);
      alert(`Failed to pay all fines: ${err.message}`);
    } finally {
      setSubmitting(false);
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
      await fetchAll();
      window.open(`/receipt/${fineId}`, "_blank");
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

  // ---- search + pagination ----
  const filteredFines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return fines;
    return fines.filter((f) => {
      const idMatch = String(f.id).includes(term);
      const titleMatch = (f.book_title || "").toLowerCase().includes(term);
      return idMatch || titleMatch;
    });
  }, [fines, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredFines.length / PAGE_SIZE));
  const paginatedFines = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFines.slice(start, start + PAGE_SIZE);
  }, [filteredFines, currentPage]);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
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
            {totalUnpaid > 0 && (
              <button className="pay-all-btn" onClick={openPayAllModal} disabled={submitting}>
                {submitting ? "Processing..." : "💰 Pay All"}
              </button>
            )}
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
          <div className="table-header">
            <h2>Fine History</h2>
            <input
              type="text"
              className="search-input"
              placeholder="Search by receipt ID or book title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredFines.length === 0 ? (
            <p className="center">No fines match your search.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
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
                  {paginatedFines.map((fine) => (
                    <tr
                      key={fine.id}
                      className="fine-row"
                      onClick={() =>
                        window.open(
                          fine.payment_group_id
                            ? `/receipt/group/${fine.payment_group_id}`
                            : `/receipt/${fine.id}`,
                          "_blank"
                        )
                      }
                    >
                      <td>#{fine.id}</td>
                      <td><span className="type-badge">{fine.fine_type}</span></td>
                      <td>{fine.book_title || "—"}</td>
                      <td>₱{Number(fine.amount).toFixed(2)}</td>
                      <td>{fine.notes || "—"}</td>
                      <td><span className={`badge ${statusColor(fine.status)}`}>{fine.status}</span></td>
                      <td>{new Date(fine.created_at).toLocaleDateString()}</td>
                      <td>{fine.paid_at ? new Date(fine.paid_at).toLocaleDateString() : "—"}</td>
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        {fine.status === "unpaid" && (
                          <>
                            <button
                              className="action-btn mark-paid"
                              onClick={() => {
                                const amountToPay = prompt(`Fine Amount: ₱${fine.amount}. Enter amount paid:`, fine.amount);
                                if (amountToPay && !isNaN(amountToPay)) {
                                  handlePay(fine.id, Number(amountToPay));
                                }
                              }}
                              title="Mark as paid"
                            >
                              ✓ Pay
                            </button>
                            <button
                              className="action-btn waive-btn"
                              onClick={() => handleWaive(fine.id)}
                              title="Waive fine"
                            >
                              ✦ Waive
                            </button>
                          </>
                        )}
                        {fine.status !== "unpaid" && <span className="resolved">Resolved</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PAGINATION */}
              <div className="pagination">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                  ‹ Prev
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages} · {filteredFines.length} fine{filteredFines.length !== 1 ? "s" : ""}
                </span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                  Next ›
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* PAY ALL MODAL */}
      {payAllModal && (
        <div className="modal-overlay" onClick={() => setPayAllModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Pay All Unpaid Fines</h3>
            <p>
              Total due: ₱
              {fines
                .filter((f) => f.status === "unpaid")
                .reduce((s, f) => s + Number(f.amount), 0)
                .toFixed(2)}
            </p>
            <label>Amount Paid (₱)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={payAllAmount}
              onChange={(e) => setPayAllAmount(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="add-btn" onClick={confirmPayAll} disabled={submitting}>
                {submitting ? "Processing..." : "Confirm Payment"}
              </button>
              <button className="back-btn" onClick={() => setPayAllModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-main { margin-left: 260px; padding: 30px; background: #f9fbe7; min-height: 100vh; }
        .center { text-align: center; color: #777; padding-top: 50px; }
        .back-btn { background: #2e7d32; color: white; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; margin-bottom: 20px; }
        .user-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px; border-radius: 12px; border: 1px solid #c5e1a5; margin-bottom: 20px; }
        .user-header h1 { margin: 0; color: #2e7d32; }
        .user-header p { margin: 4px 0 0; color: #666; }
        .total-fine { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
        .total-fine span { font-size: 0.85rem; color: #666; }
        .total-fine strong { font-size: 1.6rem; font-weight: 700; }
        .has-fine strong { color: #c62828; }
        .no-fine strong { color: #2e7d32; }
        .pay-all-btn { margin-top: 8px; background: #2e7d32; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; }
        .pay-all-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .card { background: white; border: 1px solid #c5e1a5; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .card h2 { color: #2e7d32; margin: 0 0 16px; }
        .table-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
        .table-header h2 { margin: 0; }
        .search-input { padding: 10px 14px; border-radius: 8px; border: 1px solid #c5e1a5; font-size: 0.9rem; min-width: 280px; }
        .fine-form { display: flex; flex-direction: column; gap: 12px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 0.85rem; font-weight: 600; color: #4e342e; }
        input, select { padding: 10px; border-radius: 8px; border: 1px solid #c5e1a5; font-size: 0.95rem; }
        .add-btn { background: #2e7d32; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; align-self: flex-start; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #e8f5e9; color: #1b5e20; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
        .fine-row { cursor: pointer; }
        .fine-row:hover { background: #f1f8e9; }
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
        .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 16px; }
        .pagination button { background: #2e7d32; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; }
        .pagination button:disabled { background: #c5e1a5; cursor: not-allowed; opacity: 0.7; }
        .page-info { color: #555; font-size: 0.9rem; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 999; }
        .modal-box { background: white; padding: 24px; border-radius: 12px; width: 320px; display: flex; flex-direction: column; gap: 10px; }
        .modal-box h3 { margin: 0; color: #2e7d32; }
        .modal-actions { display: flex; gap: 8px; margin-top: 10px; }
      `}</style>
    </>
  );
}