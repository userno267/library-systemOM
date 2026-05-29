// src/pages/admin/Dashboard.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";
import AdminSidebar from "../../components/AdminSidebar";

export default function Dashboard() {
  const [overview, setOverview] = useState({});
  const [borrowTrends, setBorrowTrends] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [topBooks, setTopBooks] = useState([]);
  const [topBorrowers, setTopBorrowers] = useState([]);
  const [aiInsight, setAiInsight] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);

  const token = localStorage.getItem("token");
  const headers = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true"
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [o, t, g, b, u] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/overview`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/borrow-trends`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/user-growth`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/top-books`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/top-borrowers`, { headers }),
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
  };

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

  const statusData = [
    { name: "Active", value: overview.activeBorrows || 0 },
    { name: "Returned", value: overview.returnedBorrows || 0 },
    { name: "Overdue", value: overview.overdueBorrows || 0 },
  ];

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <h1 className="page-title">Dashboard Analytics</h1>

        {/* AI INSIGHT */}
        <div className="card">
          <h2 className="section-title">🤖 AI Insights</h2>

          {loadingAI ? <p>Generating...</p> : (
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

        {/* CHART GRID */}
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

        {/* STATUS PIE */}
        <div className="card">
          <h2 className="section-title">📊 Borrow Status</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} dataKey="value" outerRadius={100}>
                {statusData.map((_, i) => <Cell key={i} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* TABLES */}
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

      <style >{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
        }

        .page-title {
          color: #2e7d32;
          margin-bottom: 20px;
        }

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

        .summary {
          margin-bottom: 15px;
        }

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

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          background: #e8f5e9;
          padding: 10px;
          text-align: left;
        }

        td {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }

        tr:hover {
          background: #f1f8e9;
        }
      `}</style>
    </>
  );
}

/* SMALL COMPONENTS */
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