// src/pages/admin/Dashboard.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from "recharts";
import AdminSidebar from "../../components/AdminSidebar";

const PIE_COLORS = ["#66bb6a", "#2e7d32", "#ef5350"];

export default function Dashboard() {
  /* ── existing state ── */
  const [overview, setOverview]         = useState({});
  const [borrowTrends, setBorrowTrends] = useState([]);
  const [userGrowth, setUserGrowth]     = useState([]);
  const [topBooks, setTopBooks]         = useState([]);
  const [topBorrowers, setTopBorrowers] = useState([]);
  const [aiInsight, setAiInsight]       = useState({});
  const [loadingAI, setLoadingAI]       = useState(false);

  /* ── NEW: ML state ── */
  const [mlData, setMlData]       = useState(null);
  const [mlInsight, setMlInsight] = useState(null);
  const [loadingML, setLoadingML] = useState(false);

  const token   = localStorage.getItem("token");
  const headers = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true"
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── existing fetch ── */
  const fetchAll = async () => {
    try {
      const [o, t, g, b, u] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/overview`,       { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/borrow-trends`,  { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/user-growth`,    { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/top-books`,      { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/top-borrowers`,  { headers }),
      ]);

      setOverview(o.data);
      setBorrowTrends(t.data);
      setUserGrowth(g.data);
      setTopBooks(b.data);
      setTopBorrowers(u.data);

      generateAI(o.data, t.data, b.data, u.data);
    } catch (err) {
      console.error(err);
    }

    /* ── NEW: fetch ML separately so it doesn't block existing data ── */
    fetchML();
  };

  /* ── existing AI ── */
  const generateAI = async (o, t, b, u) => {
    setLoadingAI(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/dashboard/ai-insight`,
        { overview: o, borrowTrends: t, topBooks: b, topBorrowers: u },
        { headers }
      );
      setAiInsight(res.data || {});
    } catch {
      setAiInsight({ summary: "AI failed." });
    }
    setLoadingAI(false);
  };

  /* ── NEW: ML fetch + insight ── */
  const fetchML = async () => {
    setLoadingML(true);
    try {
      const mlRaw = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/dashboard/ml-data`,
        { headers }
      );
      setMlData(mlRaw.data);

      const mlRes = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/dashboard/ml-insight`,
        mlRaw.data,
        { headers }
      );
      setMlInsight(mlRes.data);
    } catch (err) {
      console.error("ML fetch failed", err);
      setMlInsight({ forecastSummary: "ML analysis unavailable." });
    }
    setLoadingML(false);
  };

  const statusData = [
    { name: "Active",   value: overview.activeBorrows   || 0 },
    { name: "Returned", value: overview.returnedBorrows || 0 },
    { name: "Overdue",  value: overview.overdueBorrows  || 0 },
  ];

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <h1 className="page-title">Dashboard Analytics</h1>

        {/* ════════════════ EXISTING: AI INSIGHT ════════════════ */}
        <div className="card">
          <h2 className="section-title">🤖 AI Insights</h2>

          {loadingAI ? <p className="loading-text">Generating...</p> : (
            <>
              <p className="summary">{aiInsight.summary}</p>
              <div className="cards">
                {aiInsight.cards?.map((c, i) => (
                  <StatCard key={i} title={c.title} value={c.value} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ════════════════ NEW: ML PREDICTIVE INSIGHTS ════════════════ */}
        <div className="card ml-card">
          <div className="ml-header">
            <h2 className="section-title">🧠 ML Predictive Insights</h2>
            <span className="ml-badge">Powered by Linear Regression &amp; Behavioral Scoring</span>
          </div>

          {loadingML ? (
            <div className="ml-loading">
              <div className="ml-spinner" />
              <p>Running predictive analysis...</p>
            </div>
          ) : mlInsight ? (
            <>
              {/* ── FORECAST ── */}
              <div className="ml-block">
                <h3 className="ml-subtitle">📈 Borrowing Forecast</h3>
                <div className="forecast-row">
                  <div className="forecast-box">
                    <div className="forecast-number">
                      {mlInsight.predictedNextMonth ?? "—"}
                    </div>
                    <div className="forecast-label">Predicted borrows next month</div>
                  </div>
                  <p className="ml-text">{mlInsight.forecastSummary}</p>
                </div>

                {/* monthly volume mini-chart */}
                {mlData?.monthlyVolume?.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={mlData.monthlyVolume}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total_borrows" stroke="#2e7d32" name="Borrows" dot={false} />
                      <Line type="monotone" dataKey="returned"      stroke="#66bb6a" name="Returned" dot={false} strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="overdue"       stroke="#ef5350" name="Overdue"  dot={false} strokeDasharray="2 2" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ── PEAK DAY ── */}
              <div className="ml-block">
                <h3 className="ml-subtitle">📅 Peak Borrowing Period</h3>
                <p className="ml-text">{mlInsight.peakDay}</p>

                {mlData?.dowPattern?.length > 0 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={mlData.dowPattern}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day_name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="#66bb6a" radius={[4, 4, 0, 0]} name="Borrows" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ── SUBJECT DEMAND ── */}
              {mlInsight.subjectInsights?.length > 0 && (
                <div className="ml-block">
                  <h3 className="ml-subtitle">📚 Subject Demand Patterns</h3>

                  {/* subject bar chart from raw data */}
                  {mlData?.subjectDemand?.length > 0 && (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={mlData.subjectDemand} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="subject" type="category" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="total_borrows" fill="#81c784" radius={[0, 4, 4, 0]} name="Borrows" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  <div className="insight-grid">
                    {mlInsight.subjectInsights.map((s, i) => (
                      <div key={i} className="insight-card">
                        <strong>{s.subject}</strong>
                        <p>{s.insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── AT-RISK STUDENTS ── */}
              {mlInsight.atRiskStudents?.length > 0 && (
                <div className="ml-block">
                  <h3 className="ml-subtitle">⚠️ At-Risk Student Detection</h3>
                  <p className="ml-hint">Students flagged by behavioral overdue-rate scoring</p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>LRN</th>
                          <th>Risk Level</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mlInsight.atRiskStudents.map((s, i) => (
                          <tr key={i}>
                            <td>{s.name}</td>
                            <td>{s.lrn}</td>
                            <td>
                              <span className={`badge badge-${s.risk?.toLowerCase()}`}>
                                {s.risk}
                              </span>
                            </td>
                            <td>{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── HOT BOOKS ── */}
              {mlInsight.hotBooks?.length > 0 && (
                <div className="ml-block">
                  <h3 className="ml-subtitle">🔥 Book Heat Score</h3>
                  <p className="ml-hint">Ranked by frequency-recency heat scoring algorithm</p>

                  {mlData?.bookHeat?.length > 0 && (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={mlData.bookHeat.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="title" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="heat_score" fill="#ff7043" radius={[4, 4, 0, 0]} name="Heat Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  <div className="insight-grid">
                    {mlInsight.hotBooks.map((b, i) => (
                      <div key={i} className="insight-card hot">
                        <strong>{b.title}</strong>
                        <p>{b.insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── RECOMMENDATIONS ── */}
              {mlInsight.recommendations?.length > 0 && (
                <div className="ml-block" style={{ borderBottom: "none", marginBottom: 0 }}>
                  <h3 className="ml-subtitle">💡 AI-Generated Recommendations</h3>
                  <div className="rec-grid">
                    {mlInsight.recommendations.map((r, i) => (
                      <div key={i} className={`rec-card priority-${r.priority?.toLowerCase()}`}>
                        <div className="rec-top">
                          <span className="rec-category">{r.category}</span>
                          <span className={`rec-priority-badge priority-badge-${r.priority?.toLowerCase()}`}>
                            {r.priority} Priority
                          </span>
                        </div>
                        <p>{r.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="ml-text">No ML data available yet.</p>
          )}
        </div>

        {/* ════════════════ EXISTING: CHART GRID ════════════════ */}
        <div className="grid">
          <div className="card">
            <h2 className="section-title">📈 Borrow Trends</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={borrowTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2e7d32" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2 className="section-title">👥 User Growth</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#66bb6a" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ════════════════ EXISTING: STATUS PIE ════════════════ */}
        <div className="card">
          <h2 className="section-title">📊 Borrow Status</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} dataKey="value" outerRadius={100} label>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* ════════════════ EXISTING: TABLES ════════════════ */}
        <div className="grid">
          <div className="card">
            <h2 className="section-title">📚 Top Books</h2>
            <Table
              headers={["Title", "Borrows"]}
              data={topBooks.map(b => [b.title, b.borrows])}
            />
          </div>

          <div className="card">
            <h2 className="section-title">🏆 Top Borrowers</h2>
            <Table
              headers={["Name", "LRN", "Total"]}
              data={topBorrowers.map(u => [u.full_name, u.lrn, u.total])}
            />
          </div>
        </div>
      </div>

      {/* ════════════════ STYLES ════════════════ */}
      <style>{`
        /* ── layout ── */
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .page-title {
          color: #2e7d32;
          margin-bottom: 20px;
          font-size: 1.6rem;
        }

        /* ── base card ── */
        .card {
          background: white;
          border: 1px solid #c5e1a5;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .section-title {
          color: #2e7d32;
          margin-bottom: 15px;
        }

        .summary { margin-bottom: 15px; }

        .loading-text { color: #888; font-style: italic; }

        /* ── stat cards ── */
        .cards {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }

        .stat {
          background: #f1f8e9;
          border-radius: 10px;
          padding: 15px;
          min-width: 140px;
        }

        /* ── grid ── */
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        /* ── base table ── */
        table { width: 100%; border-collapse: collapse; }
        th { background: #e8f5e9; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        tr:hover { background: #f1f8e9; }

        /* ════ ML CARD ════ */
        .ml-card { border-color: #a5d6a7; }

        .ml-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .ml-header .section-title { margin-bottom: 0; }

        .ml-badge {
          font-size: 0.72rem;
          background: #e8f5e9;
          color: #388e3c;
          padding: 3px 10px;
          border-radius: 20px;
          border: 1px solid #c5e1a5;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        /* ── ML loading ── */
        .ml-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #888;
          padding: 10px 0;
        }

        .ml-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #c5e1a5;
          border-top-color: #2e7d32;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── ML blocks ── */
        .ml-block {
          margin-bottom: 28px;
          padding-bottom: 24px;
          border-bottom: 1px solid #f1f8e9;
        }

        .ml-subtitle {
          color: #388e3c;
          margin-bottom: 10px;
          font-size: 1rem;
          font-weight: 600;
        }

        .ml-text {
          color: #555;
          margin-bottom: 12px;
          line-height: 1.55;
        }

        .ml-hint {
          font-size: 0.82rem;
          color: #888;
          margin-bottom: 12px;
          font-style: italic;
        }

        /* ── forecast ── */
        .forecast-row {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .forecast-box {
          background: linear-gradient(135deg, #e8f5e9, #f1f8e9);
          border: 1px solid #c5e1a5;
          border-radius: 14px;
          padding: 16px 28px;
          text-align: center;
          flex-shrink: 0;
        }

        .forecast-number {
          font-size: 2.8rem;
          font-weight: 700;
          color: #2e7d32;
          line-height: 1;
        }

        .forecast-label {
          font-size: 0.78rem;
          color: #666;
          margin-top: 4px;
        }

        /* ── insight grid ── */
        .insight-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .insight-card {
          background: #f1f8e9;
          border-radius: 10px;
          padding: 12px;
          border-left: 4px solid #66bb6a;
        }

        .insight-card.hot {
          border-left-color: #ff7043;
          background: #fff8f6;
        }

        .insight-card strong {
          display: block;
          margin-bottom: 5px;
          color: #2e7d32;
          font-size: 0.9rem;
        }

        .insight-card.hot strong { color: #bf360c; }

        .insight-card p {
          font-size: 0.82rem;
          color: #555;
          margin: 0;
          line-height: 1.45;
        }

        /* ── table wrap ── */
        .table-wrap { overflow-x: auto; }

        /* ── badges ── */
        .badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .badge-high   { background: #ffcdd2; color: #c62828; }
        .badge-medium { background: #fff9c4; color: #f57f17; }
        .badge-low    { background: #c8e6c9; color: #2e7d32; }

        /* ── recommendations ── */
        .rec-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }

        .rec-card {
          background: #f9fbe7;
          border-radius: 10px;
          padding: 14px 16px;
          border-left: 5px solid #aed581;
        }

        .rec-card.priority-high   { border-left-color: #ef5350; background: #fff8f8; }
        .rec-card.priority-medium { border-left-color: #ffa726; background: #fffdf5; }
        .rec-card.priority-low    { border-left-color: #aed581; }

        .rec-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
          gap: 6px;
        }

        .rec-category {
          font-size: 0.72rem;
          background: #e8f5e9;
          padding: 2px 8px;
          border-radius: 10px;
          color: #388e3c;
          font-weight: 700;
        }

        .rec-priority-badge {
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 600;
        }

        .priority-badge-high   { background: #ffcdd2; color: #c62828; }
        .priority-badge-medium { background: #fff9c4; color: #f57f17; }
        .priority-badge-low    { background: #c8e6c9; color: #2e7d32; }

        .rec-card p {
          margin: 0;
          color: #444;
          font-size: 0.88rem;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}

/* ════════════════ SMALL COMPONENTS ════════════════ */
function StatCard({ title, value }) {
  return (
    <div className="stat">
      <p>{title}</p>
      <h2>{value || 0}</h2>
    </div>
  );
}

function Table({ headers, data }) {
  return (
    <table>
      <thead>
        <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
