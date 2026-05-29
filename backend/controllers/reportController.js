import db from "../db/db.js";

/* =========================================
   DATE HELPERS
========================================= */
const getMonthlyRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date();
  return { start, end };
};

const getLast30DaysRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return { start, end };
};

const validateDateRange = (startDate, endDate) => {
  if (startDate && endDate) {
    if (new Date(startDate) > new Date(endDate)) {
      return false;
    }
  }
  return true;
};

/* =========================================
   1️⃣ BOOK INVENTORY REPORT
========================================= */
export const fetchInventoryReportData = async (query = {}) => {
  let { startDate, endDate, section, type, availability } = query;

  let where = "WHERE 1=1";
  const params = [];

  // ✅ FIX: only apply date filter if BOTH exist
  if (startDate && endDate) {
    where += " AND b.created_at BETWEEN ? AND ?";
    params.push(startDate, endDate);
  }

  if (section) {
    where += " AND b.section = ?";
    params.push(section);
  }

  if (type) {
    where += " AND b.type = ?";
    params.push(type);
  }

  if (availability === "available") {
    where += " AND b.copies > 0";
  }

  console.log("INVENTORY QUERY:", where);
  console.log("PARAMS:", params);

  const [rows] = await db.query(
    `
    SELECT 
      b.id,
      b.title,
      b.author,
      b.isbn,
      b.publisher,
      b.section,
      b.type,
      b.copies,
      b.created_at,
      COUNT(DISTINCT br.id) AS total_borrowed
    FROM books b
    LEFT JOIN borrows br ON br.book_id = b.id
    ${where}
    GROUP BY 
      b.id,
      b.title,
      b.author,
      b.isbn,
      b.publisher,
      b.section,
      b.type,
      b.copies,
      b.created_at
    ORDER BY b.created_at DESC
    `,
    params
  );

  console.log("RESULT COUNT:", rows.length);

  return rows;
};

export const getInventoryReport = async (req, res) => {
  try {
    if (!validateDateRange(req.query.startDate, req.query.endDate)) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const data = await fetchInventoryReportData(req.query);
    res.json(data);
  } catch (err) {
    console.error("INVENTORY REPORT ERROR:", err);
    res.status(500).json({ message: "Failed to generate inventory report" });
  }
};

/* =========================================
   2️⃣ OVERVIEW REPORT (DEFAULT: CURRENT MONTH)
========================================= */
export const getOverviewReportData = async (query = {}) => {
  let { startDate, endDate } = query;

  if (!startDate || !endDate) {
    const range = getMonthlyRange();
    startDate = range.start;
    endDate = range.end;
  }

  const params = [startDate, endDate];

  const [[{ totalUsers }]] = await db.query(
    "SELECT COUNT(*) AS totalUsers FROM users"
  );

  const [[{ totalBorrows }]] = await db.query(
    `SELECT COUNT(*) AS totalBorrows 
     FROM borrows 
     WHERE borrowed_at BETWEEN ? AND ?`,
    params
  );

  const [[{ activeBorrows }]] = await db.query(
    `SELECT COUNT(*) AS activeBorrows 
     FROM borrows 
     WHERE returned_at IS NULL`
  );

  const [[{ returnedBorrows }]] = await db.query(
    `SELECT COUNT(*) AS returnedBorrows 
     FROM borrows 
     WHERE returned_at IS NOT NULL`
  );

  const [[{ overdueBorrows }]] = await db.query(
    `SELECT COUNT(*) AS overdueBorrows 
     FROM borrows 
     WHERE returned_at IS NULL 
     AND due_date < NOW()`
  );

  const [[avgDuration]] = await db.query(
    `SELECT AVG(DATEDIFF(returned_at, borrowed_at)) AS avgBorrowDuration
     FROM borrows
     WHERE returned_at IS NOT NULL
     AND borrowed_at BETWEEN ? AND ?`,
    params
  );

  const [topBooks] = await db.query(
    `SELECT bk.title, COUNT(*) AS total
     FROM borrows br
     JOIN books bk ON br.book_id = bk.id
     WHERE br.borrowed_at BETWEEN ? AND ?
     GROUP BY br.book_id
     ORDER BY total DESC
     LIMIT 10`,
    params
  );

  return {
    range: { startDate, endDate },
    totalUsers,
    totalBorrows,
    activeBorrows,
    returnedBorrows,
    overdueBorrows,
    avgBorrowDuration: avgDuration.avgBorrowDuration || 0,
    topBooks,
  };
};

export const getOverviewReport = async (req, res) => {
  try {
    if (!validateDateRange(req.query.startDate, req.query.endDate)) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const data = await getOverviewReportData(req.query);
    res.json(data);
  } catch (err) {
    console.error("OVERVIEW REPORT ERROR:", err);
    res.status(500).json({ message: "Failed to generate overview report" });
  }
};

/* =========================================
   3️⃣ CURRENTLY BORROWED (DEFAULT: LAST 30 DAYS)
========================================= */
export const getCurrentlyBorrowedReportData = async (query = {}) => {
  let { startDate, endDate } = query;

  if (!startDate || !endDate) {
    const range = getLast30DaysRange();
    startDate = range.start;
    endDate = range.end;
  }

  const [rows] = await db.query(
    `SELECT 
        bk.title,
        u.full_name,
        u.lrn,
        br.borrowed_at,
        br.due_date,
        GREATEST(DATEDIFF(NOW(), br.due_date), 0) AS days_overdue
      FROM borrows br
      JOIN books bk ON br.book_id = bk.id
      JOIN users u ON br.user_id = u.id
      WHERE br.returned_at IS NULL
      AND br.borrowed_at BETWEEN ? AND ?
      ORDER BY br.due_date ASC`,
    [startDate, endDate]
  );

  return { range: { startDate, endDate }, data: rows };
};

export const getCurrentlyBorrowedReport = async (req, res) => {
  try {
    if (!validateDateRange(req.query.startDate, req.query.endDate)) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const data = await getCurrentlyBorrowedReportData(req.query);
    res.json(data);
  } catch (err) {
    console.error("CURRENT BORROWED REPORT ERROR:", err);
    res.status(500).json({ message: "Failed to generate current borrowed report" });
  }
};

/* =========================================
   4️⃣ OVERDUE & FINE REPORT (DEFAULT: LAST 30 DAYS)
========================================= */
export const getOverdueReportData = async (query = {}) => {
  let { startDate, endDate } = query;
  const finePerDay = 5;

  if (!startDate || !endDate) {
    const range = getLast30DaysRange();
    startDate = range.start;
    endDate = range.end;
  }

  const [rows] = await db.query(
    `SELECT 
        bk.title,
        u.full_name,
        u.lrn,
        br.borrowed_at,
        br.due_date,
        DATEDIFF(NOW(), br.due_date) AS days_overdue,
        (DATEDIFF(NOW(), br.due_date) * ?) AS fine
      FROM borrows br
      JOIN books bk ON br.book_id = bk.id
      JOIN users u ON br.user_id = u.id
      WHERE br.returned_at IS NULL
      AND br.due_date < NOW()
      AND br.borrowed_at BETWEEN ? AND ?
      ORDER BY days_overdue DESC`,
    [finePerDay, startDate, endDate]
  );

  return { range: { startDate, endDate }, finePerDay, data: rows };
};

export const getOverdueReport = async (req, res) => {
  try {
    if (!validateDateRange(req.query.startDate, req.query.endDate)) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const data = await getOverdueReportData(req.query);
    res.json(data);
  } catch (err) {
    console.error("OVERDUE REPORT ERROR:", err);
    res.status(500).json({ message: "Failed to generate overdue report" });
  }
};