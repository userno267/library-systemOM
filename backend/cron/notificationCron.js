import cron from "node-cron";
import db from "../db/db.js";

export const startNotificationCron = (io) => {
  // 🔹 Run daily at 8 AM
  cron.schedule("0 8 * * *", async () => {
    console.log("🔔 Running daily notification job...");

    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // ===============================
      // 1️⃣ Due Soon (2 days window)
      // ===============================
      const [dueSoon] = await db.query(
        `SELECT b.*, u.id AS user_id, bk.title
         FROM borrows b
         JOIN users u ON b.user_id = u.id
         JOIN books bk ON b.book_id = bk.id
         WHERE b.returned_at IS NULL
         AND b.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 DAY)`
      );

      for (const borrow of dueSoon) {
        // Check if notification already sent today
        const [exists] = await db.query(
          `SELECT 1 FROM notifications 
           WHERE related_borrow_id = ? 
             AND type = 'due_soon' 
             AND DATE(created_at) = ?`,
          [borrow.id, today]
        );

        if (exists.length > 0) continue; // already sent today

        await db.query(
          `INSERT INTO notifications
           (user_id, title, message, type, related_borrow_id)
           VALUES (?, ?, ?, 'due_soon', ?)`,
          [
            borrow.user_id,
            "Book Due Soon",
            `Your book "${borrow.title}" is due on ${borrow.due_date}`,
            borrow.id
          ]
        );

       const [result] = await db.query(
  `INSERT INTO notifications
   (user_id, title, message, type, related_borrow_id)
   VALUES (?, ?, ?, 'due_soon', ?)`,
  [
    borrow.user_id,
    "Book Due Soon",
    `Your book "${borrow.title}" is due on ${borrow.due_date}`,
    borrow.id
  ]
);

const [rows] = await db.query(
  `SELECT * FROM notifications WHERE id = ?`,
  [result.insertId]
);

io.to(`user_${borrow.user_id}`).emit("newNotification", rows[0]);
      }

      // ===============================
      // 2️⃣ Overdue
      // ===============================
      const [overdue] = await db.query(
        `SELECT b.*, u.id AS user_id, bk.title
         FROM borrows b
         JOIN users u ON b.user_id = u.id
         JOIN books bk ON b.book_id = bk.id
         WHERE b.returned_at IS NULL
         AND b.due_date < NOW()`
      );

      for (const borrow of overdue) {
        await db.query(
          `UPDATE borrows SET status = 'overdue'
           WHERE id = ?`,
          [borrow.id]
        );

        // Check if overdue notification already sent today
        const [existsOverdue] = await db.query(
          `SELECT 1 FROM notifications 
           WHERE related_borrow_id = ? 
             AND type = 'overdue' 
             AND DATE(created_at) = ?`,
          [borrow.id, today]
        );

        if (existsOverdue.length > 0) continue; // already sent today

        await db.query(
          `INSERT INTO notifications
           (user_id, title, message, type, related_borrow_id)
           VALUES (?, ?, ?, 'overdue', ?)`,
          [
            borrow.user_id,
            "Book Overdue",
            `Your book "${borrow.title}" is overdue.`,
            borrow.id
          ]
        );

        io.to(`user_${borrow.user_id}`).emit("newNotification", {
          message: `Your book "${borrow.title}" is overdue!`
        });
      }

      console.log("✅ Daily notification job complete");
    } catch (err) {
      console.error("❌ Notification Cron Error:", err);
    }
  });
};