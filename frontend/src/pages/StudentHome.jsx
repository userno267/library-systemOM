import { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import { AuthContext } from "../context/AuthContext";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function RecommendationSkeleton({ count = 6 }) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .skel-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .skel-card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 8px rgba(0,0,0,0.07);
        }
        .skel-pulse {
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        .skel-cover  { width: 100%; height: 160px; }
        .skel-body   { padding: 10px; display: flex; flex-direction: column; gap: 7px; }
        .skel-title  { height: 12px; border-radius: 4px; width: 80%; }
        .skel-author { height: 10px; border-radius: 4px; width: 55%; }
        .skel-btn    { height: 28px; border-radius: 8px; width: 100%; margin-top: 4px; }
      `}</style>
      <div className="skel-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div className="skel-card" key={i}>
            <div className="skel-cover skel-pulse" />
            <div className="skel-body">
              <div className="skel-title  skel-pulse" />
              <div className="skel-author skel-pulse" />
              <div className="skel-btn   skel-pulse" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: "#999" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem", color: "#555" }}>
        No recommendations yet
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 13 }}>
        Borrow a few books and we'll suggest ones you'll love.
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StudentHome() {
  const { token } = useContext(AuthContext);
  const [books, setBooks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [source, setSource]   = useState(null);

  useEffect(() => {
    if (token) fetchRecommendations();
  }, [token]);

  const fetchRecommendations = async () => {
    if (!token) {
      setError("Authentication token not found");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/recommendations`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      // Handle both old bare-array and new { recommendations, source } shape
      if (Array.isArray(data)) {
        setBooks(data);
      } else {
        setBooks(data.recommendations ?? []);
        setSource(data.source ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setError("Could not load recommendations");
    } finally {
      setLoading(false);
    }
  };

  const subtitleText =
    source === "popular_fallback"
      ? "Most popular in the library"
      : "Based on your borrowing history";

  return (
    <>
      <Sidebar />
      <div className="main">
        <h1>📚 Recommended for You</h1>
        <p className="subtitle">{subtitleText}</p>

        {loading && <RecommendationSkeleton count={6} />}

        {!loading && error && <p className="center error">{error}</p>}

        {!loading && !error && books.length === 0 && <EmptyState />}

        {!loading && !error && books.length > 0 && (
          <div className="book-grid">
            {books.map((book) => {
              const id       = book.book_id ?? book.id;
              const coverUrl = book.cover_image
                ? `${import.meta.env.VITE_API_URL}${book.cover_image}`
                : "/placeholder-book.png";

              return (
                <div key={id} className="book-card">
                  <img src={coverUrl} alt={book.title} loading="lazy" />
                  <h3>{book.title}</h3>
                  <p className="author">by {book.author}</p>

                  {book.section && (
                    <p className="section">{book.section}</p>
                  )}

                  {book.reason && book.reason !== "popular" && (
                    <span className="reason-badge">
                      {book.reason === "collaborative"
                        ? "👥 Students like you"
                        : "✨ Based on your reads"}
                    </span>
                  )}

                  <p className="copies">
                    {book.copies > 0
                      ? `${book.copies} cop${book.copies === 1 ? "y" : "ies"} available`
                      : "Currently unavailable"}
                  </p>

                  <Link to={`/books/${id}`}>
                    <button>View Details</button>
                  </Link>
                </div>
              );
            })}
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
          margin-bottom: 4px;
        }
        .subtitle {
          text-align: center;
          color: #777;
          font-size: 0.85rem;
          margin-bottom: 20px;
        }
        .center       { text-align: center; color: #777; }
        .center.error { color: #c62828; }

        .book-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .book-card {
          background: #fff;
          border-radius: 12px;
          padding: 10px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
        }
        .book-card img {
          width: 100%;
          height: 160px;
          object-fit: cover;
          border-radius: 10px;
        }
        .book-card h3 {
          font-size: 0.9rem;
          margin: 6px 0 2px;
          color: #1b5e20;
        }
        .book-card .author {
          font-size: 0.8rem;
          color: #4e342e;
          margin: 0 0 2px;
        }
        .book-card .section {
          font-size: 0.75rem;
          color: #827717;
          margin: 0 0 4px;
        }
        .book-card .copies {
          font-size: 0.72rem;
          color: #555;
          margin: 2px 0 4px;
        }
        .reason-badge {
          display: inline-block;
          font-size: 0.7rem;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 20px;
          padding: 2px 8px;
          margin-bottom: 6px;
        }
        .book-card button {
          width: 100%;
          margin-top: auto;
          padding: 7px;
          border: none;
          border-radius: 8px;
          background: #2e7d32;
          color: #fff;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .book-card button:active { background: #1b5e20; }
      `}</style>
    </>
  );
}