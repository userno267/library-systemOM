// src/pages/admin/EditBook.jsx

import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import AsyncCreatableSelect from "react-select/async-creatable";

export default function EditBook() {
  const navigate = useNavigate();
  const { id } = useParams();

  const token = localStorage.getItem("token");
  const API = import.meta.env.VITE_API_URL;

  const headers = {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true",
  };

  const [form, setForm] = useState({
    title: "",
    author: "",
    description: "",
    type: "physical",
    copies: 1,
    isbn: "",
    publisher: "",
    copyright_date: "",
    place_of_publication: "",
    volume: "",
    call_number: "",
    section: "",
  });

  const [subjects, setSubjects] = useState([]);
  const [bookFile, setBookFile] = useState(null);
  const [coverImage, setCoverImage] = useState(null);

  const [existingFile, setExistingFile] = useState(null);
  const [existingCover, setExistingCover] = useState(null);

  const [qrCodePreview, setQrCodePreview] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  /* ================= SUBJECT SEARCH ================= */
  const loadSubjects = async (inputValue) => {
    if (!inputValue) return [];

    try {
      const res = await axios.get(`${API}/api/books/subjects`, {
        params: { q: inputValue },
        headers: { "ngrok-skip-browser-warning": "true" },
      });

      return Array.isArray(res.data)
        ? res.data.map((s) => ({
            value: s.value || s.name || s,
            label: s.label || s.name || s,
          }))
        : [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  /* ================= LOAD BOOK ================= */
  useEffect(() => {
    const fetchBook = async () => {
      try {
        const res = await axios.get(`${API}/api/books/${id}`, { headers });
        const b = res.data.book || res.data;

        setForm({
          title: b.title || "",
          author: b.author || "",
          description: b.description || "",
          type: b.type || "physical",
          copies: b.copies || 1,
          isbn: b.isbn || "",
          publisher: b.publisher || "",
          copyright_date: b.copyright_date || "",
          place_of_publication: b.place_of_publication || "",
          volume: b.volume || "",
          call_number: b.call_number || "",
          section: b.section || "",
        });

        setSubjects(
          (b.subjects || []).map((s) => ({
            value: s.name,
            label: s.name,
          }))
        );

        setExistingFile(b.file_path || null);
        setExistingCover(b.cover_image || null);
        setQrCodePreview(b.qr_code_text || null);
      } catch (err) {
        console.error(err);
        alert("Failed to load book");
      }
    };

    fetchBook();
  }, [id]);

  /* ================= UPDATE ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSingleLoading(true);
    setProgress(20);

    try {
      const data = new FormData();

      Object.entries(form).forEach(([k, v]) => data.append(k, v));

      data.append("subjects", subjects.map((s) => s.value).join(","));

      if (bookFile) data.append("book_file", bookFile);
      if (coverImage) data.append("cover_image", coverImage);

      setProgress(60);

      await axios.put(`${API}/api/books/${id}`, data, { headers });

      setProgress(100);
      alert("Book updated successfully!");
      navigate("/admin/books");
    } catch (err) {
      console.error(err);
      alert("Failed to update book");
    }

    setSingleLoading(false);
    setProgress(0);
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">
        <div className="card">

          <h1 className="section-title">Edit Book</h1>

          <form onSubmit={handleSubmit} className="form">

            <div className="grid">
              <div className="field">
                <label>Title</label>
                <input name="title" value={form.title} onChange={handleChange} />
              </div>

              <div className="field">
                <label>Author</label>
                <input name="author" value={form.author} onChange={handleChange} />
              </div>
            </div>

            <div className="field">
              <label>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} />
            </div>

            <div className="meta-box">

              <div className="grid">
                <div className="field">
                  <label>ISBN</label>
                  <input name="isbn" value={form.isbn} onChange={handleChange} />
                </div>

                <div className="field">
                  <label>Publisher</label>
                  <input name="publisher" value={form.publisher} onChange={handleChange} />
                </div>
              </div>
<div className="grid">

  <div className="field">
    <label>Place of Publication</label>
    <input
      name="place_of_publication"
      value={form.place_of_publication}
      onChange={handleChange}
    />
  </div>

  <div className="field">
    <label>Volume</label>
    <input
      name="volume"
      value={form.volume}
      onChange={handleChange}
    />
  </div>

</div>
              <div className="field">
                <label>📅 Copyright Date</label>
                <input type="date" name="copyright_date" value={form.copyright_date} onChange={handleChange} />
                <small>Publication / copyright year</small>
              </div>

              <div className="grid">
                <div className="field">
                  <label>Call Number</label>
                  <input name="call_number" value={form.call_number} onChange={handleChange} />
                </div>

                <div className="field">
                  <label>Section</label>
                  <input name="section" value={form.section} onChange={handleChange} />
                </div>
              </div>

            </div>

            <div className="field">
              <label>Type</label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
              </select>
            </div>

            {form.type === "physical" && (
              <div className="field">
                <label>Copies</label>
                <input type="number" name="copies" value={form.copies} onChange={handleChange} />
              </div>
            )}

            {/* SUBJECTS */}
            <div className="field">
              <label>Subjects</label>

              <AsyncCreatableSelect
                isMulti
                cacheOptions
                defaultOptions
                loadOptions={loadSubjects}
                value={subjects}
                onChange={(val) => setSubjects(val || [])}
                placeholder="Type to search or create subjects..."
                closeMenuOnSelect={false}
                blurInputOnSelect={false}
                isClearable
                styles={{
                  control: (base, state) => ({
                    ...base,
                    borderRadius: "10px",
                    borderColor: state.isFocused ? "#2e7d32" : "#c5e1a5",
                    boxShadow: state.isFocused ? "0 0 0 3px rgba(46,125,50,0.15)" : "none",
                    minHeight: "48px",
                  }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: "10px",
                    overflow: "hidden",
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? "#e8f5e9" : "white",
                    color: "#2e7d32",
                    cursor: "pointer",
                  }),
                }}
                formatCreateLabel={(inputValue) =>
                  `➕ Create subject "${inputValue}"`
                }
                noOptionsMessage={({ inputValue }) =>
                  inputValue ? `No match for "${inputValue}"` : "Type to search subjects"
                }
              />
            </div>

            {/* FILES */}
            <div className="file-section">

              <div className="field">
                <label>📄 Book File (PDF)</label>
                <div className="file-box">
                  {existingFile && (
                    <a href={`${API}${existingFile}`} target="_blank">
                      View Current File
                    </a>
                  )}
                  <input type="file" accept=".pdf" onChange={(e) => setBookFile(e.target.files[0])} />
                  <p className="hint">Upload PDF / digital book file</p>
                </div>
              </div>

              <div className="field">
                <label>🖼 Cover Image</label>
                <div className="file-box">
                  {existingCover && (
                    <div className="cover-preview">
                      <img src={`${API}${existingCover}`} alt="Cover" />
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setCoverImage(e.target.files[0])} />
                  <p className="hint">JPG / PNG cover image</p>
                </div>
              </div>

            </div>

            {singleLoading && (
              <div className="progress">
                <div style={{ width: `${progress}%` }} />
              </div>
            )}

            <button disabled={singleLoading}>
              {singleLoading ? "Updating Book..." : "Update Book"}
            </button>

          </form>
        </div>

        {qrCodePreview && (
          <div className="qr-card">
            <h2 className="section-title">📷 QR Code</h2>
            <img src={qrCodePreview} alt="QR" />
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

        .page-title {
          color: #2e7d32;
          margin-bottom: 20px;
        }

        .card {
          background: white;
          border: 1px solid #c5e1a5;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
        }

        .section-title {
          color: #2e7d32;
          margin-bottom: 15px;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        input, textarea, select {
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #c5e1a5;
        }

        .meta-box {
          border: 1px solid #c5e1a5;
          padding: 15px;
          border-radius: 12px;
          background: #fff;
        }

        .file-box {
          border: 1px dashed #c5e1a5;
          padding: 12px;
          border-radius: 10px;
          background: #f9fbe7;
        }

        .hint {
          font-size: 0.75rem;
          color: #6d4c41;
        }

        button {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 10px;
          font-weight: 700;
        }

        .progress {
          height: 8px;
          background: #ddd;
          border-radius: 6px;
          overflow: hidden;
        }

        .progress div {
          height: 100%;
          background: #2e7d32;
        }

        .qr-card {
          background: white;
          border: 1px solid #c5e1a5;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        }

        .qr-card img {
          width: 180px;
        }

        .cover-preview {
          display: flex;
          justify-content: center;
          padding: 10px;
        }

        .cover-preview img {
          width: 240px;
          height: 340px;
          object-fit: cover;
          border-radius: 12px;
          border: 2px solid #c5e1a5;
        }
      `}</style>
    </>
  );
}