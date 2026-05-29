// src/pages/admin/ViewBook.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";

export default function ViewBook() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const token = localStorage.getItem("token");
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const res = await axios.get(`${API}/api/books/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });
        setBook(res.data.book || res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBook();
  }, [id]);

  if (!book) return <p>Loading...</p>;

  const coverUrl = book.cover_image ? `${API}${book.cover_image}` : "";
  const fileUrl = book.file_path ? `${API}${book.file_path}` : null;
  const fileName = book.file_path?.split("/").pop();

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <h1 className="page-title">Book Details</h1>

        <div className="layout">

          {/* LEFT SIDE */}
          <div className="left">

            {coverUrl && (
              <div className="cover-box">
                <img src={coverUrl} alt={book.title} />
              </div>
            )}

            {book.qr_code_text && (
              <div className="qr-card">
                <h3>QR Code</h3>
                <img src={book.qr_code_text} alt="QR" />
              </div>
            )}

          </div>

          {/* RIGHT SIDE */}
          <div className="right">

            <div className="card">
              <h2>{book.title}</h2>
              <p className="author">{book.author}</p>
            </div>

            <div className="card grid">
              <p><strong>Type:</strong> {book.type}</p>
              {book.type === "physical" && <p><strong>Copies:</strong> {book.copies}</p>}
              <p><strong>Section:</strong> {book.section || "—"}</p>
              <p><strong>ISBN:</strong> {book.isbn || "—"}</p>
              <p><strong>Publisher:</strong> {book.publisher || "—"}</p>
              <p><strong>Copyright:</strong> {book.copyright_date || "—"}</p>
              <p><strong>Place:</strong> {book.place_of_publication || "—"}</p>
              <p><strong>Volume:</strong> {book.volume || "—"}</p>
              <p><strong>Call No:</strong> {book.call_number || "—"}</p>
            </div>

            {/* DESCRIPTION */}
            <div className="card">
              <h3>Description</h3>
              <p>{book.description || "No description"}</p>
            </div>

            {/* SUBJECTS */}
            <div className="card">
              <h3>Subjects</h3>
              <div className="tags">
                {book.subjects?.length
                  ? book.subjects.map((s, i) => (
                      <span key={i}>{s.name}</span>
                    ))
                  : "None"}
              </div>
            </div>

            {/* FILE */}
            {fileName && (
              <div className="card">
                <h3>Book File</h3>
                <p>{fileName}</p>

                <a href={fileUrl} target="_blank">
                  📄 View / Download
                </a>
              </div>
            )}

            {/* ACTIONS */}
            <div className="actions">
              {fileName && (
                <button onClick={() => navigate(`/admin/books/${book.id}/read`)}>
                  📘 Read
                </button>
              )}

              <button className="back" onClick={() => navigate(-1)}>
                ⬅ Back
              </button>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        .admin-main {
          margin-left: 260px;
          padding: 30px;
          background: #f9fbe7;
          min-height: 100vh;
        }

        .page-title {
          color: #2e7d32;
          margin-bottom: 20px;
        }

        .layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 25px;
        }

        .left {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .cover-box img {
          width: 100%;
          height: 420px;
          object-fit: cover;
          border-radius: 12px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          transition: transform 0.2s;
        }

        .cover-box img:hover {
          transform: scale(1.05);
        }

        .qr-card {
          background: white;
          padding: 15px;
          border-radius: 12px;
          text-align: center;
        }

        .qr-card img {
          width: 180px;
        }

        .right {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .card {
          background: white;
          padding: 15px;
          border-radius: 12px;
          border: 1px solid #c5e1a5;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .author {
          color: #666;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tags span {
          background: #e8f5e9;
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 0.85rem;
        }

        .actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }

        button {
          padding: 10px 14px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
        }

        button:first-child {
          background: #2e7d32;
          color: white;
        }

        .back {
          background: #ccc;
        }
      `}</style>
    </>
  );
}