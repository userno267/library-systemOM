import { useState } from "react";
import axios from "axios";
import AdminSidebar from "../../components/AdminSidebar";
import AsyncCreatableSelect from "react-select/async-creatable";

export default function AddBook() {
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
  const [bulkFile, setBulkFile] = useState(null);

  const [qrCodePreview, setQrCodePreview] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const token = localStorage.getItem("token");
  const API = import.meta.env.VITE_API_URL;

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  /* ================= SUBJECT SEARCH (FIXED UX) ================= */
  const loadSubjects = async (inputValue) => {
    if (!inputValue) return [];

    try {
       const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/books/subjects`,
      {
        params: { q: inputValue },
        headers: {
          "ngrok-skip-browser-warning": "true"
        }
      });

      return Array.isArray(res.data)
        ? res.data.map((s) => ({
            value: s.value || s.name || s,
            label: s.label || s.name || s,
          }))
        : [];
    } catch (err) {
      console.error("Subject load error:", err);
      return [];
    }
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSingleLoading(true);
    setProgress(20);

    try {
      const data = new FormData();

      Object.entries(form).forEach(([k, v]) => data.append(k, v));

      if (bookFile) data.append("book_file", bookFile);
      if (coverImage) data.append("cover_image", coverImage);

      data.append("subjects", subjects.map((s) => s.value).join(","));

      setProgress(60);

      const res = await axios.post(`${API}/api/books`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProgress(100);
      setQrCodePreview(res.data.qrCodeText);

      alert("Book added successfully");

      setForm({
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

      setSubjects([]);
      setBookFile(null);
      setCoverImage(null);
    } catch (err) {
      console.error(err);
      alert("Failed to add book");
    }

    setSingleLoading(false);
    setProgress(0);
  };

  /* ================= BULK ================= */
  const handleBulkUpload = async () => {
    if (!bulkFile) return alert("Select ZIP file");

    setBulkLoading(true);
    setProgress(10);

    try {
      const data = new FormData();
      data.append("zip", bulkFile);

      setProgress(50);

      const res = await axios.post(`${API}/api/books/bulk-upload`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProgress(100);
      alert(`Done: ${res.data.inserted}/${res.data.total} books imported`);

      setBulkFile(null);
    } catch (err) {
      console.error(err);
      alert("Bulk upload failed");
    }

    setBulkLoading(false);
    setProgress(0);
  };

  return (
    <>
      <AdminSidebar />

      <div className="admin-main">

          <h1>Add Book</h1>

        {/* ================= SINGLE ================= */}
        <div className="card">
          <h2 className="section-title">📘 Add Single Book</h2>

          <form onSubmit={handleSubmit} className="form">

            {/* BASIC INFO */}
            <div className="grid">
              <div className="field">
                <label>Title</label>
                <input name="title" onChange={handleChange} />
              </div>

              <div className="field">
                <label>Author</label>
                <input name="author" onChange={handleChange} />
              </div>
            </div>

            <div className="field">
              <label>Description</label>
              <textarea name="description" onChange={handleChange} />
            </div>

            {/* META */}
            <div className="meta-box">

              <div className="grid">
                <div className="field">
                  <label>ISBN</label>
                  <input name="isbn" onChange={handleChange} />
                </div>

                <div className="field">
                  <label>Publisher</label>
                  <input name="publisher" onChange={handleChange} />
                </div>
              </div>
<div className="grid">

  <div className="field">
    <label>Publisher</label>
    <input name="publisher" onChange={handleChange} />
  </div>

  <div className="field">
    <label>Place of Publication</label>
    <input name="place_of_publication" onChange={handleChange} />
  </div>

</div>

<div className="grid">

  <div className="field">
    <label>Volume</label>
    <input name="volume" onChange={handleChange} />
  </div>

  <div className="field">
    <label>Call Number</label>
    <input name="call_number" onChange={handleChange} />
  </div>

</div>
              <div className="field">
                <label>📅 Copyright Date</label>
                <input type="date" name="copyright_date" onChange={handleChange} />
                <small>Publication / copyright year</small>
              

              <div className="grid">
                <div className="field">
                  <label>Call Number</label>
                  <input name="call_number" onChange={handleChange} />
                </div>

                <div className="field">
                  <label>Section</label>
                  <input name="section" onChange={handleChange} />
                </div>
              </div>
      </div>
            </div>

            {/* TYPE */}
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
                <input type="number" name="copies" onChange={handleChange} />
              </div>
            )}

            {/* ================= SUBJECTS (FIXED UX) ================= */}
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

  // UX tuning (THIS is what you were missing)
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
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setBookFile(e.target.files[0])}
                  />
                  <p className="hint">Upload PDF / digital book file</p>
                </div>
              </div>

              <div className="field">
                <label>🖼 Cover Image</label>
                <div className="file-box">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files[0])}
                  />
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
              {singleLoading ? "Adding Book..." : "Add Book"}
            </button>

          </form>
        </div>

        {/* ================= BULK ================= */}
        <div className="card">
          <h2 className="section-title">📦 Bulk Upload</h2>

          <input
            type="file"
            accept=".zip"
            onChange={(e) => setBulkFile(e.target.files[0])}
          />

          {bulkLoading && (
            <div className="progress">
              <div style={{ width: `${progress}%` }} />
            </div>
          )}

          <button onClick={handleBulkUpload} disabled={bulkLoading}>
            {bulkLoading ? "Uploading..." : "Upload ZIP"}
          </button>
        </div>

        {/* ================= QR ================= */}
        {qrCodePreview && (
          <div className="qr-card">
            <h2 className="section-title">📷 Generated QR</h2>
            <img src={qrCodePreview} alt="QR Code" />
          </div>
        )}

      </div>

      <style jsx>{`
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
      `}</style>
    </>
  );
}