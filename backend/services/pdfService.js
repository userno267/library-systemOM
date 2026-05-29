// services/pdfService.js
import PDFDocument from "pdfkit";

/**
 * Generate Professional PDF (Portrait or Landscape)
 */
export const generateReportPDF = ({
  res,
  title = "Library Report",
  data = [],
  columns = [],
  summary = null,
  options = {},
}) => {
  const {
    fontSize = 12,
    primaryColor = "#000000",
    orientation = "landscape", // NEW OPTION
  } = options;

  const doc = new PDFDocument({
    size: "A4",
    layout: orientation === "portrait" ? "portrait" : "landscape",
    margin: 40,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${title.replace(/\s+/g, "_")}.pdf"`
  );

  doc.pipe(res);

  /* ===============================
     HEADER
  =============================== */
  doc
    .fontSize(20)
    .fillColor(primaryColor)
    .text(title, { align: "center" });

  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("gray")
    .text(`Generated on: ${new Date().toLocaleString()}`, {
      align: "center",
    });

  doc.moveDown(1.5);

  /* ===============================
     SUMMARY SECTION (Optional)
  =============================== */
  if (summary) {
    doc
      .fontSize(fontSize + 2)
      .fillColor(primaryColor)
      .text("Executive Summary", { underline: true });

    doc.moveDown(0.5);

    Object.entries(summary).forEach(([key, value]) => {
      doc
        .fontSize(fontSize)
        .fillColor("#000000")
        .text(`${key}: ${value}`);
    });

    doc.moveDown(1.5);
  }

  /* ===============================
     TABLE ENGINE (FIXED)
  =============================== */

  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const startX = doc.page.margins.left;
  let y = doc.y;

  const columnWidth = pageWidth / columns.length;

  /* ---------- TABLE HEADER ---------- */
  doc.font("Helvetica-Bold").fontSize(fontSize);

  let x = startX;

  columns.forEach((col) => {
    doc.text(col.header, x, y, {
      width: columnWidth,
      align: "left",
    });
    x += columnWidth;
  });

  y += fontSize + 10;

  doc
    .moveTo(startX, y)
    .lineTo(startX + pageWidth, y)
    .stroke();

  y += 10;

  /* ---------- TABLE ROWS ---------- */
  doc.font("Helvetica").fontSize(fontSize);

  data.forEach((row) => {
    let rowHeight = 0;
    x = startX;

    // Calculate tallest cell in row
    columns.forEach((col) => {
      const text = row[col.key] ? String(row[col.key]) : "—";
      const height = doc.heightOfString(text, {
        width: columnWidth,
      });
      rowHeight = Math.max(rowHeight, height);
    });

    // Page break check
    if (y + rowHeight > doc.page.height - 50) {
      doc.addPage({
        layout: orientation === "portrait" ? "portrait" : "landscape",
      });
      y = 50;
    }

    // Render cells
    columns.forEach((col) => {
      const text = row[col.key] ? String(row[col.key]) : "—";

      doc.text(text, x, y, {
        width: columnWidth,
        align: "left",
      });

      x += columnWidth;
    });

    y += rowHeight + 10;
  });

  /* ===============================
     FOOTER
  =============================== */
  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillColor("gray")
    .text("Confidential - Library Management System", {
      align: "center",
    });

  doc.end();
};