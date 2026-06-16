// controllers/attendanceController.js

import db from "../db/db.js";

/* ═══════════════════════════════════════
   SCAN — time in or time out
   Called when student scans wall QR
   Requires: auth middleware (req.user.id)
═══════════════════════════════════════ */
export const scanAttendance = async (req, res) => {
  const userId = req.user.id;

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Check if user already has a record today
    const [[existing]] = await db.query(
      `SELECT * FROM attendance 
       WHERE user_id = ? AND date = ?`,
      [userId, today]
    );

    if (!existing) {
      // No record today — TIME IN
      await db.query(
        `INSERT INTO attendance (user_id, time_in, date)
         VALUES (?, NOW(), ?)`,
        [userId, today]
      );

      return res.json({
        action: "time_in",
        message: "Time in recorded successfully",
        time: new Date().toISOString()
      });
    }

    if (existing.time_out) {
      // Already timed in AND timed out today
      return res.status(400).json({
        message: "You have already completed attendance for today"
      });
    }

    // Has time_in but no time_out — TIME OUT
    await db.query(
      `UPDATE attendance 
       SET time_out = NOW()
       WHERE id = ?`,
      [existing.id]
    );

    return res.json({
      action: "time_out",
      message: "Time out recorded successfully",
      time: new Date().toISOString()
    });

  } catch (err) {
    console.error("ATTENDANCE SCAN ERROR:", err);
    res.status(500).json({ message: "Failed to record attendance" });
  }
};

/* ═══════════════════════════════════════
   ADMIN — get all attendance
   Supports: date filter, search by name/lrn, pagination
═══════════════════════════════════════ */
export const getAttendance = async (req, res) => {
  const {
    page   = 1,
    limit  = 20,
    search = "",
    date   = ""
  } = req.query;

  const pageNum  = Number(page);
  const limitNum = Number(limit);
  const offset   = (pageNum - 1) * limitNum;

  try {
    let where  = "WHERE 1=1";
    const params = [];

    if (date) {
      where += " AND a.date = ?";
      params.push(date);
    }

    if (search) {
      where += " AND (u.full_name LIKE ? OR u.lrn LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(
      `SELECT 
         a.id,
         a.date,
         a.time_in,
         a.time_out,
         u.full_name,
         u.lrn,
         u.id AS user_id
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       ${where}
       ORDER BY a.date DESC, a.time_in DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       ${where}`,
      params
    );

    res.json({
      attendance: rows,
      total,
      page:       pageNum,
      totalPages: Math.ceil(total / limitNum)
    });

  } catch (err) {
    console.error("GET ATTENDANCE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch attendance" });
  }
};

/* ═══════════════════════════════════════
   ADMIN — get attendance summary stats
   For the top stat cards
═══════════════════════════════════════ */
export const getAttendanceStats = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [[todayIn]]   = await db.query(
      `SELECT COUNT(*) AS count FROM attendance WHERE date = ?`, [today]
    );
    const [[todayOut]]  = await db.query(
      `SELECT COUNT(*) AS count FROM attendance WHERE date = ? AND time_out IS NOT NULL`, [today]
    );
    const [[stillIn]]   = await db.query(
      `SELECT COUNT(*) AS count FROM attendance WHERE date = ? AND time_out IS NULL`, [today]
    );
    const [[totalAll]]  = await db.query(
      `SELECT COUNT(*) AS count FROM attendance`
    );

    res.json({
      todayTotal:   todayIn.count,
      todayOut:     todayOut.count,
      currentlyIn:  stillIn.count,
      allTimeTotal: totalAll.count
    });
  } catch (err) {
    console.error("ATTENDANCE STATS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};