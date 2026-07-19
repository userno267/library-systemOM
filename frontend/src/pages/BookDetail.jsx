import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import socket from "../socket";

// ─── Similar books section ────────────────────────────────────────────────────
function SimilarBooksSkeleton() {
  return (
    <div className="similar-grid">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="similar-card similar-skel" key={i} />
      ))}
    </div>
  );
}

function SimilarBooks({ books, loading }) {
  if (loading) {
    return (
      <div className="similar-section">
        <h3>You might also like</h3>
        <SimilarBooksSkeleton />
      </div>
    );
  }

  if (!books.length) return null;

  return (
    <div className="similar-section">
      <h3>You might also like</h3>
      <div className="similar-grid">
        {books.map((b) => {
          const coverUrl = b.cover_image
            ? `${import.meta.env.VITE_API_URL}${b.cover_image}`
            : "/placeholder-book.png";

          return (
            <Link to={`/books/${b.book_id}`} className="similar-card" key={b.book_id}>
              <img
                src={coverUrl}
                alt={b.title}
                onError={(e) => (e.target.src = "/placeholder-book.png")}
              />
              <p className="similar-title">{b.title}</p>
              <p className="similar-author">{b.author}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [borrowStatus, setBorrowStatus] = useState(null);

  const [similarBooks, setSimilarBooks] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(true);

  const token = localStorage.getItem("token");
  const userId = token ? JSON.parse(atob(token.split(".")[1])).id : null;

  const fetchBook = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/books/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      setBook(res.data);

      // IMPORTANT FIX:
      // ensure NULL override so UI doesn't get stuck
      setBorrowStatus(res.data.borrowStatus || null);

    } catch (err) {
      console.error("Failed to load book:", err);
    }
  };

  const fetchWishlistStatus = async () => {
    if (!token) return;

    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/wishlist/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      setInWishlist(res.data.inWishlist);
    } catch (err) {
      console.error("Failed to fetch wishlist status:", err);
    }
  };

  const fetchSimilarBooks = async () => {
    setLoadingSimilar(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/recommendations/${id}/similar`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      setSimilarBooks(res.data.similar ?? []);
    } catch (err) {
      console.error("Failed to fetch similar books:", err);
      setSimilarBooks([]);
    } finally {
      setLoadingSimilar(false);
    }
  };

  useEffect(() => {
    fetchBook();
    fetchWishlistStatus();
    fetchSimilarBooks();
  }, [id]);

  useEffect(() => {
    if (!token || !userId) return;

    if (!socket.connected) socket.connect();

    socket.auth = { token };
    socket.emit("join", `user_${userId}`);

    const handleBorrowUpdate = (data) => {
      if (Number(data.bookId) === Number(id)) {
        fetchBook(); // always refresh full state
      }
    };

    socket.on("borrowUpdate", handleBorrowUpdate);

    return () => {
      socket.off("borrowUpdate", handleBorrowUpdate);
    };
  }, [id, token, userId]);

  const handleBorrow = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/borrow`,
        { book_id: id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      alert("Request sent. Waiting for librarian approval.");
      fetchBook();

    } catch (err) {
      alert(err.response?.data?.message || "Borrow failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/return`,
        { book_id: id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      alert("Return request sent. Please wait for librarian approval.");
      fetchBook();

    } catch (err) {
      alert(err.response?.data?.message || "Return failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async () => {
    if (!token) return;

    try {
      if (!inWishlist) {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/wishlist`,
          { book_id: id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "ngrok-skip-browser-warning": "true",
            },
          }
        );
        setInWishlist(true);
      } else {
        await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/wishlist/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "ngrok-skip-browser-warning": "true",
            },
          }
        );
        setInWishlist(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!book) return <p>Loading book details...</p>;

  const coverUrl = book.cover_image
    ? `${import.meta.env.VITE_API_URL}${book.cover_image}`
    : "/placeholder-book.png";

  return (
    <>
      <Sidebar />

      <div className="main-content">
        <div className="book-card">
          <img
            src={coverUrl}
            alt={book.title}
            className="cover"
            onError={(e) => (e.target.src = "/placeholder-book.png")}
          />

          <div className="info">
            
<h2>{book.title}</h2>

{/* ✅ QR CODE DISPLAY */}
{book.qr_code_text && (
  <div className="qr-section">
    <h3>📱 Scan to Share</h3>
    <img
      src={book.qr_code_text}
      alt="QR Code"
      className="qr-code"
    />
  </div>
)}

{borrowStatus && (
  <p style={{ fontWeight: "bold" }}>
    Status: {borrowStatus.replace("_", " ").toUpperCase()}
  </p>
)}

<p><strong>Author:</strong> {book.author}</p>
<p><strong>Publisher:</strong> {book.publisher || "—"}</p>
<p><strong>Copyright:</strong> {book.copyright_date || "—"}</p>
<p><strong>Place of Publication:</strong> {book.place_of_publication || "—"}</p>
<p><strong>Volume:</strong> {book.volume || "—"}</p>
<p><strong>Call Number:</strong> {book.call_number || "—"}</p>
<p><strong>Section:</strong> {book.section || "—"}</p>
<p><strong>ISBN:</strong> {book.isbn || "—"}</p>

{/* ✅ SUBJECTS */}
{book.subjects && book.subjects.length > 0 && (
  <div className="subjects">
    <p><strong>Subjects:</strong></p>
    <div className="subject-list">
      {book.subjects.map((s) => (
        <span key={s.id} className="subject-tag">
          {s.name}
        </span>
      ))}
    </div>
  </div>
)}

<p><strong>Description:</strong></p>

            <p className="desc">{book.description || "No description"}</p>

            {book.type === "physical" && (
              <p><strong>Stock:</strong> {book.copies}</p>
            )}
<div className="actions2">
            {book.type === "digital" && (
              <button onClick={() => navigate(`/EbookView/${book.id}`)}>
                📖 Read Book
              </button>
            )}
</div>
            {book.type === "physical" && (
              <div className="actions">
                

                {!borrowStatus && book.copies > 0 && (
                  <button disabled={loading} onClick={handleBorrow}>
                    📚 Borrow Book
                  </button>
                )}

                {!borrowStatus && book.copies === 0 && (
                  <button onClick={toggleWishlist}>
                    {inWishlist ? "💚 Wishlisted" : "🤍 Add to Wishlist"}
                  </button>
                )}

                {borrowStatus === "pending_borrow" && (
                  <button disabled>⏳ Waiting for approval</button>
                )}

                {borrowStatus === "borrowed" && (
                  <button onClick={handleReturn} disabled={loading}>
                    🔁 Return Book
                  </button>
                )}

                {borrowStatus === "pending_return" && (
                  <button disabled>⏳ Return pending approval</button>
                )}

                {borrowStatus === "returned" && (
                  <button disabled>✔ Returned</button>
                )}

              </div>
            )}
          </div>
        </div>

        <SimilarBooks books={similarBooks} loading={loadingSimilar} />
      </div>

      <BottomNav />

      <style jsx>{`
        .main-content {
          padding: 80px 20px 100px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .cover {
          width: 100%;
          max-width: 280px;
          display: block;
          margin: 0 auto 15px;
          border-radius: 12px;
        }

        h2 {
          text-align: center;
          margin-bottom: 10px;
        }

        p {
          margin: 6px 0;
          color: #444;
        }
      .actions2 button {
          width: 100%;
          padding: 14px;
          margin: 15px 0;
          border-radius: 10px;
          border: none;
          font-size: 1rem;
          font-weight: bold;
          background: #2e7d32;
          color: white;
          cursor: pointer;
        }

        .actions button {
          width: 100%;
          padding: 14px;
          margin: 15px 0;
          border-radius: 10px;
          border: none;
          font-size: 1rem;
          font-weight: bold;
          background: #2e7d32;
          color: white;
          cursor: pointer;
        }

        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .read-btn {
          background: #1565c0;
          margin-top: 10px;
        }

        .read-btn:hover {
          background: #0d47a1;
        }

        h3 {
          margin-top: 30px;
        }

        .history {
          background: white;
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 10px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
          .subject-list {
  display: flex;
  flex-wrap: wrap; /* allows tags to go to next line */
  gap: 8px; /* spacing between tags */
}

        /* ─── Similar books section ─────────────────────────────────────── */
        .similar-section {
          max-width: 600px;
          margin: 30px auto 0;
        }

        .similar-section h3 {
          text-align: center;
          color: #2e7d32;
          margin-bottom: 14px;
        }

        .similar-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .similar-card {
          background: #fff;
          border-radius: 10px;
          padding: 6px;
          text-align: center;
          text-decoration: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          display: block;
        }

        .similar-card img {
          width: 100%;
          height: 90px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 4px;
        }

        .similar-title {
          font-size: 0.72rem;
          font-weight: 600;
          color: #1b5e20;
          margin: 2px 0 0;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .similar-author {
          font-size: 0.65rem;
          color: #777;
          margin: 2px 0 0;
        }

        .similar-skel {
          height: 130px;
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }

        @media (max-width: 600px) {
          .similar-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </>
  );
}