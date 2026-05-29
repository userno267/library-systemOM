import express from "express";
import {
  addBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  getEbooks,
  getSections,
  getSubjects,
  printQRCodes,
  getPBooks,
  bulkDeleteBooks
} from "../controllers/bookController.js";
import { upload } from "../middleware/upload.js";
import { auth } from "../middleware/auth.js";
import { uploadZip } from "../middleware/uploadZip.js";
import { uploadBooksZip } from "../controllers/bookBulkController.js";
const router = express.Router();

router.post("/bulk-upload", uploadZip.single("zip"), uploadBooksZip);
router.delete("/bulk-delete", bulkDeleteBooks);
// Create book
router.post(
  "/",
  upload.fields([
    { name: "book_file", maxCount: 1 },
    { name: "cover_image", maxCount: 1 },
  ]),
  addBook
);


// Update book
router.put(
  "/:id",
  upload.fields([
    { name: "book_file", maxCount: 1 },
    { name: "cover_image", maxCount: 1 },
  ]),
  updateBook
);

// Fetch books
router.get("/", getBooks);
router.get("/ebooks", getEbooks);      // must be before /:id
router.get("/sections", getSections);  // ✅ NEW
  router.get("/subjects", getSubjects);
router.get("/physical", getPBooks);
import path from "path";
import fs from "fs";
import pool from "../db/db.js";
router.get("/view/:id", auth,async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      "SELECT file_path FROM books WHERE id = ?",
      [id]
    );

    if (!rows.length || !rows[0].file_path) {
      return res.status(404).send("File not found");
    }

    const filePath = path.join(
      process.cwd(),
      "public",
      rows[0].file_path
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File missing");
    }

    // ✅ REQUIRED HEADERS
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Accept-Ranges", "bytes");

    fs.createReadStream(filePath).pipe(res);

  } catch (err) {
    console.error("VIEW PDF ERROR:", err);
    res.status(500).send("Server error");
  }
});

router.post("/print-qrcodes",printQRCodes);

// Fetch single book
router.get("/:id",auth ,getBookById );

// Delete book
router.delete("/:id", deleteBook);

export default router;
