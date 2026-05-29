import express from "express";
import {
  getInventoryReport,
  getOverviewReport,
  getCurrentlyBorrowedReport,
  getOverdueReport,
  fetchInventoryReportData,
  getOverviewReportData,
  getCurrentlyBorrowedReportData,
  getOverdueReportData,
} from "../controllers/reportController.js";

import { auth } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";
import { generateReportPDF } from "../services/pdfService.js";

const router = express.Router();

/* =========================================
   🔐 PROTECT ALL REPORT ROUTES (ADMIN ONLY)
========================================= */

/* =========================================
   📊 REPORT ROUTES
========================================= */

// 1️⃣ Book Inventory Report
router.get("/inventory", getInventoryReport);

// 2️⃣ Executive Overview Report
router.get("/overview", getOverviewReport);

// 3️⃣ Currently Borrowed Report
router.get("/currently-borrowed", getCurrentlyBorrowedReport);

// 4️⃣ Overdue & Fine Report
router.get("/overdue", getOverdueReport);

/* =========================================
   🔜 PDF EXPORT ROUTE
========================================= */
router.get("/export/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { orientation = "landscape", ...query } = req.query;

    let reportData;
    let title = "";
    let summary = null;
    let columns = [];

    switch (type) {

      /* =====================================
         1️⃣ INVENTORY
      ===================================== */
      case "inventory":
        reportData = await fetchInventoryReportData(query);

        title = "Book Inventory Report";

        columns = [
          { header: "Title", key: "title" },
          { header: "Author", key: "author" },
          { header: "ISBN", key: "isbn" },
          { header: "Publisher", key: "publisher" },
          { header: "Section", key: "section" },
          { header: "Type", key: "type" },
          { header: "Copies", key: "copies" },
          { header: "Total Borrowed", key: "total_borrowed" },
        ];
        break;

      /* =====================================
         2️⃣ OVERVIEW
      ===================================== */
      case "overview":
        const overview = await getOverviewReportData(query);

        title = "Executive Overview Report";

        summary = {
          "Total Users": overview.totalUsers,
          "Total Borrows": overview.totalBorrows,
          "Active Borrows": overview.activeBorrows,
          "Returned Borrows": overview.returnedBorrows,
          "Overdue Borrows": overview.overdueBorrows,
          "Average Borrow Duration":
            overview.avgBorrowDuration + " days",
        };

        columns = [
          { header: "Book Title", key: "title" },
          { header: "Total Borrows", key: "total" },
        ];

        reportData = overview.topBooks;
        break;

      /* =====================================
         3️⃣ CURRENTLY BORROWED
      ===================================== */
      case "currently-borrowed":
        const current = await getCurrentlyBorrowedReportData(query);

        title = "Currently Borrowed Report";

        columns = [
          { header: "Book Title", key: "title" },
          { header: "Borrower Name", key: "full_name" },
          { header: "LRN", key: "lrn" },
          { header: "Borrowed At", key: "borrowed_at" },
          { header: "Due Date", key: "due_date" },
          { header: "Days Overdue", key: "days_overdue" },
        ];

        reportData = current.data;
        break;

      /* =====================================
         4️⃣ OVERDUE
      ===================================== */
      case "overdue":
        const overdue = await getOverdueReportData(query);

        title = "Overdue & Fine Report";

        columns = [
          { header: "Book Title", key: "title" },
          { header: "Borrower Name", key: "full_name" },
          { header: "LRN", key: "lrn" },
          { header: "Borrowed At", key: "borrowed_at" },
          { header: "Due Date", key: "due_date" },
          { header: "Days Overdue", key: "days_overdue" },
          { header: "Fine", key: "fine" },
        ];

        summary = {
          "Fine Per Day": overdue.finePerDay,
          "Total Overdue Records": overdue.data.length,
        };

        reportData = overdue.data;
        break;

      default:
        return res.status(400).json({ message: "Invalid report type" });
    }

    /* =====================================
       GENERATE PDF
    ===================================== */

    generateReportPDF({
      res,
      title,
      data: reportData || [],
      columns,
      summary,
      options: {
        fontSize: 12,
        primaryColor: "#000000",
        orientation, // ✅ NOW PASSED
      },
    });

  } catch (err) {
    console.error("PDF EXPORT ERROR:", err);
    res.status(500).json({ message: "Failed to export PDF" });
  }
});

export default router;