


import AdmZip from "adm-zip";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import db from "../db/db.js";

/* ================= HELPERS ================= */

const normalize = (str = "") =>
  str.toLowerCase().replace(/[^a-z0-9]/g, "");

const getAllFilesRecursive = (dir) => {
  let results = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      results = results.concat(getAllFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
};

const levenshtein = (a, b) => {
  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }

  return matrix[b.length][a.length];
};

const similarity = (a, b) => {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
};

const findBestImage = (images, title, isbn) => {
  const cleanTitle = normalize(title);
  const cleanIsbn = normalize(isbn);

  /* ===== FUZZY TITLE FIRST ===== */
  let bestMatch = null;
  let bestScore = 0;

  for (const img of images) {
    const name = normalize(path.basename(img));
    const score = similarity(cleanTitle, name);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = img;
    }
  }

  /* strong enough match */
  if (bestScore > 0.5) {
    console.log("🎯 fuzzy match:", bestScore);
    return bestMatch;
  }

  /* ===== ISBN FALLBACK ===== */
  if (cleanIsbn) {
    const match = images.find((img) =>
      normalize(path.basename(img)).includes(cleanIsbn)
    );

    if (match) {
      console.log("🔢 isbn match");
      return match;
    }
  }

  return null;
};

/* ═════════════════════════════════════════════
   CLEANUP — safely delete temp files
═════════════════════════════════════════════ */
const cleanupTempFiles = (zipPath, extractPath) => {
  try {
    // Delete extracted directory
    if (extractPath && fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
      console.log("🗑️ Deleted extracted directory:", extractPath);
    }

    // Delete ZIP file
    if (zipPath && fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
      console.log("🗑️ Deleted ZIP file:", zipPath);
    }
  } catch (err) {
    console.error("⚠️ Cleanup error:", err.message);
    // Don't throw — cleanup failure shouldn't fail the upload
  }
};

/* ================= MAIN ================= */

export const uploadBooksZip = async (req, res) => {
  const zipPath = req.file?.path;
  const extractPath = zipPath?.replace(".zip", "");

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No ZIP uploaded" });
    }

    console.log("📦 ZIP:", zipPath);

    // Extract
    new AdmZip(zipPath).extractAllTo(extractPath, true);
    console.log("📂 Extracted:", extractPath);

    // Get all files recursively
    const allFiles = getAllFilesRecursive(extractPath);

    // Find XLSX
    const xlsxPath = allFiles.find(f => f.endsWith(".xlsx"));
    if (!xlsxPath) {
      cleanupTempFiles(zipPath, extractPath);
      return res.status(400).json({ message: "No XLSX found in ZIP" });
    }

    // Find images
    const images = allFiles.filter(f =>
      /\.(jpg|jpeg|png|webp)$/i.test(f)
    );
    console.log("🖼️ Images found:", images.length);

    // Parse XLSX
    const workbook = xlsx.readFile(xlsxPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let inserted = 0;
    let lastCover = null;

    // Process each row
    for (const row of rows) {
      try {
        const {
          title,
          author,
          description,
          type,
          copies = 0,
          isbn,
          publisher,
          copyright_date,
          place_of_publication,
          volume,
          call_number,
          section,
          subjects = ""
        } = row;

        console.log("➡️", title);

        /* ===== IMAGE MATCH ===== */
        let imagePath = findBestImage(images, title, isbn);

        if (!imagePath && lastCover) {
          imagePath = lastCover; // fallback reuse (for volumes)
        }

        let coverPath = null;

        if (imagePath) {
          const fileName = Date.now() + "-" + path.basename(imagePath);
          const dest = path.join("public/uploads/covers", fileName);

          fs.copyFileSync(imagePath, dest);

          coverPath = `/uploads/covers/${fileName}`;
          lastCover = imagePath;

          console.log("🖼️ matched:", fileName);
        }

        /* ===== LOGIC ===== */
        const finalCopies = type === "digital" ? 0 : Number(copies || 0);

        const status =
          type === "digital" || finalCopies > 0
            ? "available"
            : "unavailable";

        /* ===== INSERT ===== */
        const [result] = await db.query(
          `INSERT INTO books
          (title, author, description, type, status, copies,
           isbn, publisher, copyright_date,
           place_of_publication, volume,
           call_number, section, cover_image)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title,
            author,
            description,
            type,
            status,
            finalCopies,
            isbn,
            publisher,
            copyright_date,
            place_of_publication,
            volume,
            call_number,
            section,
            coverPath
          ]
        );

        const bookId = result.insertId;

        /* ===== QR ===== */
        const qr = await QRCode.toDataURL(`BOOK:${bookId}`, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 300,
        });
        
        await db.query(
          "UPDATE books SET qr_code_text=? WHERE id=?",
          [qr, bookId]
        );

        /* ===== SUBJECTS ===== */
        const subjectList = subjects
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);

        for (const s of subjectList) {
          const [existing] = await db.query(
            "SELECT id FROM subjects WHERE name=?",
            [s]
          );

          const subjectId = existing.length
            ? existing[0].id
            : (await db.query(
                "INSERT INTO subjects (name) VALUES (?)",
                [s]
              ))[0].insertId;

          await db.query(
            "INSERT INTO book_subjects (book_id, subject_id) VALUES (?, ?)",
            [bookId, subjectId]
          );
        }

        inserted++;
      } catch (err) {
        console.error("❌ Failed:", row.title, err.message);
      }
    }

    // ═══════════════════════════════════════════
    // ✅ CLEANUP BEFORE RESPONDING
    // ═══════════════════════════════════════════
    cleanupTempFiles(zipPath, extractPath);

    return res.json({
      success: true,
      inserted,
      total: rows.length,
      message: `${inserted}/${rows.length} books imported successfully`
    });

  } catch (err) {
    console.error("❌ Upload error:", err.message);
    
    // ═══════════════════════════════════════════
    // 🗑️ CLEANUP ON ERROR TOO
    // ═══════════════════════════════════════════
    cleanupTempFiles(zipPath, extractPath);

    return res.status(500).json({
      message: "Bulk upload failed",
      error: err.message
    });
  }
};
