import { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import { AuthContext } from "../context/AuthContext";

export default function StudentHome() {
  const { token } = useContext(AuthContext);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/recommendations`, {
        headers: { "ngrok-skip-browser-warning": "true",
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      setBooks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setError("Could not load recommendations");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sidebar />
      <div className="main">
        <h1>📚 Recommended for You</h1>
        <p className="subtitle">Based on your borrowing history</p>

        {loading && <p className="center">Loading recommendations...</p>}
        {error && <p className="center">{error}</p>}
        {!loading && !error && books.length === 0 && <p className="center">No recommendations yet.</p>}

        <div className="book-grid">
          {books.map((book) => {
            const coverUrl = book.cover_image
              ? `${import.meta.env.VITE_API_URL}${book.cover_image}`
              : "/placeholder-book.png";

            return (
              <div key={book.id} className="book-card">
                <img src={coverUrl} alt={book.title} />
                <h3>{book.title}</h3>
                <p className="author">by {book.author}</p>
                <Link to={`/books/${book.id}`}>
                  <button>View Details</button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
      <style jsx>{`
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

        .filters {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        input,
        select {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #8d6e63;
          background: #fff8e1;
          font-weight: 500;
        }

        .center {
          text-align: center;
          color: #777;
        }

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
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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

        .book-card p {
          font-size: 0.8rem;
          color: #4e342e;
        }

        .book-card span {
          font-size: 0.75rem;
          color: #827717;
        }

        .book-card button {
          width: 100%;
          margin-top: 6px;
          padding: 6px;
          border: none;
          border-radius: 8px;
          background: #2e7d32;
          color: #fff;
          font-weight: 600;
        }

        .pagination {
          margin-top: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
        }

        .pagination button {
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          background: #2e7d32;
          color: white;
          font-weight: bold;
        }

        .pagination button:disabled {
          opacity: 0.4;
        }
      `}</style>
    </>
  );
}
