// src/pages/admin/ReportsManagement.jsx
import { useEffect, useState, useRef } from "react";
import AdminSidebar from "../../components/AdminSidebar";

export default function ReportsManagement() {
  const [reports, setReports] = useState([]);
  const [reportType, setReportType] = useState("overview");
  const [rangeType, setRangeType] = useState("30days");
  const [orientation, setOrientation] = useState("portrait"); // 
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
const [previewPDF, setPreviewPDF] = useState(null);  
const [isPDFReady, setIsPDFReady] = useState(false); 
const iframeRef = useRef(null);
  const token = localStorage.getItem("token");


  const calculateDateRange = (type) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (type) {
      case "7days":
        start.setDate(now.getDate() - 7);
        break;
      case "30days":
        start.setDate(now.getDate() - 30);
        break;
      case "3months":
        start.setMonth(now.getMonth() - 3);
        break;
      case "1year":
        start.setFullYear(now.getFullYear() - 1);
        break;
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "custom":
        return;
      default:
        break;
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

useEffect(() => {
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
      if (!previewPDF) return e.preventDefault(); // no preview yet
      e.preventDefault();

      if (!isPDFReady) {
        alert("PDF is still loading. Please wait...");
        return;
      }

      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (err) {
        console.error("Printing failed:", err);
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [previewPDF, isPDFReady]);

 
  const fetchReport = async () => {
  try {
    setLoading(true);

    const params = new URLSearchParams();

    // ✅ only attach dates if valid
    if (startDate && endDate) {
      params.append("startDate", startDate);
      params.append("endDate", endDate);
    }

    console.log("REPORT TYPE:", reportType);
    console.log("PARAMS:", params.toString());

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/reports/${reportType}?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "anyvalue",
        },
      }
    );

    if (!res.ok) throw new Error("Failed to fetch report");

    const data = await res.json();

    console.log("RESPONSE:", data);

    if (Array.isArray(data)) {
      setReports(data);
    } else if (data.data) {
      setReports(data.data);
    } else if (data.topBooks) {
      setReports(data.topBooks);
    } else {
      setReports([]);
    }

  } catch (err) {
    console.error("Error loading report:", err);
    setReports([]);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    fetchReport();
  }, [reportType, startDate, endDate]);


  const generatePreview = () => {
  const params = new URLSearchParams({
    startDate,
    endDate,
    orientation, 
  });

  fetch(`${import.meta.env.VITE_API_URL}/api/reports/export/${reportType}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "anyvalue",
    },
  })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      setPreviewPDF(url);
      setIsPDFReady(false); 
    })
    .catch((err) => console.error("PDF generation failed:", err));
};

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <div className="header">
          <div>
            <h1>Reports</h1>
            <p>Generate and export system reports</p>
          </div>

          <button className="add-btn" onClick={generatePreview}>
  📄 Preview & Print PDF
</button>
        </div>

        <div className="controls">
          {/* Report Type */}
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="overview">Overview</option>
            <option value="inventory">Inventory</option>
            <option value="currently-borrowed">Currently Borrowed</option>
            <option value="overdue">Overdue & Fine</option>
          </select>

          {/* Date Presets */}
          <select
            value={rangeType}
            onChange={(e) => setRangeType(e.target.value)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="3months">Last 3 Months</option>
            <option value="1year">Last 1 Year</option>
            <option value="thisMonth">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Custom Date Inputs */}
          {rangeType === "custom" && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          )}

          {/* ✅ Orientation Selector */}
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>

          <button onClick={fetchReport} className="add-btn secondary">
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <p className="center">Loading report...</p>
        ) : reports.length === 0 ? (
          <p className="center">No data found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {Object.keys(reports[0]).map((key) => (
                    <th key={key}>
                      {key.replaceAll("_", " ").toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewPDF && (
  <div style={{ marginTop: 20 }}>
    <iframe
      ref={iframeRef}
      src={previewPDF}
      onLoad={() => setIsPDFReady(true)}
      style={{
        width: "100%",
        height: "500px",
        border: "1px solid #ccc",
      }}
    />
    <button
      onClick={() => {
        if (isPDFReady && iframeRef.current) {
          iframeRef.current.contentWindow.focus();
          iframeRef.current.contentWindow.print();
        }
      }}
      disabled={!isPDFReady}
      style={{ marginTop: 10 }}
    >
      🖨️ {isPDFReady ? "Print Report" : "Loading PDF..."}
    </button>
  </div>
)}
          </div>
        )}
      </div>

      <style >{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .controls {
          display: flex;
          gap: 10px;
          margin: 20px 0;
          flex-wrap: wrap;
        }

        input,
        select {
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
          background: white;
        }

        .table-wrapper {
          overflow-x: auto;
          border-radius: 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }

        th,
        td {
          padding: 12px;
          border-bottom: 1px solid #ddd;
        }

        th {
          background: #c5e1a5;
          color: #1b5e20;
        }

        tr:nth-child(even) {
          background: #f1f8e9;
        }

        .add-btn {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: bold;
        }

        .secondary {
          background: #558b2f;
        }

        button:hover {
          opacity: 0.9;
          transform: scale(1.03);
          cursor: pointer;
        }

        .center {
          text-align: center;
          color: #777;
        }
      `}</style>
    </>
  );
}