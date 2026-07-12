import cron from "node-cron";
import db from "../db/db.js";

export const startNotificationCron = (io) => {
  cron.schedule("0 8 * * *", async () => {
    console.log("🔔 Running daily notification job...");

    try {
      const today = new Date().toISOString().split("T")[0];

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
        const [exists] = await db.query(
          `SELECT 1 FROM notifications 
           WHERE related_borrow_id = ? 
             AND type = 'due_soon' 
             AND DATE(created_at) = ?`,
          [borrow.id, today]
        );

        if (exists.length > 0) continue;

        const [result] = await db.query(
          `INSERT INTO notifications
           (user_id, title, message, type, related_borrow_id)
           VALUES (?, ?, ?, 'due_soon', ?)`,
          [
            borrow.user_id,
            "Book Due Soon",
            `Your book "${borrow.title}" is due on ${new Date(borrow.due_date).toLocaleDateString()}. Please return it on time to avoid a ₱5 fine.`,
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
      // 2️⃣ Overdue — mark status, create fine, notify
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

        // update borrow status to overdue
        await db.query(
          `UPDATE borrows SET status = 'overdue' WHERE id = ?`,
          [borrow.id]
        );

        // create fine if one doesn't exist yet for this borrow
        await db.query(
          `INSERT IGNORE INTO fines (user_id, borrow_id, amount, status)
           VALUES (?, ?, 5.00, 'unpaid')`,
          [borrow.user_id, borrow.id]
        );

        // check if overdue notification already sent today
        const [existsOverdue] = await db.query(
          `SELECT 1 FROM notifications 
           WHERE related_borrow_id = ? 
             AND type = 'overdue' 
             AND DATE(created_at) = ?`,
          [borrow.id, today]
        );

        if (existsOverdue.length > 0) continue;

        // get total unpaid fines for this user
        const [[{ totalFine }]] = await db.query(
          `SELECT COALESCE(SUM(amount), 0) AS totalFine
           FROM fines
           WHERE user_id = ? AND status = 'unpaid'`,
          [borrow.user_id]
        );

        const [result] = await db.query(
          `INSERT INTO notifications
           (user_id, title, message, type, related_borrow_id)
           VALUES (?, ?, ?, 'overdue', ?)`,
          [
            borrow.user_id,
            "Book Overdue — Borrowing Suspended",
            `Your book "${borrow.title}" is overdue. A ₱5 fine has been added to your account. Your total unpaid fine is ₱${totalFine}. You cannot borrow books until your fine is paid. Please visit the library to settle your balance.`,
            borrow.id
          ]
        );

        const [rows] = await db.query(
          `SELECT * FROM notifications WHERE id = ?`,
          [result.insertId]
        );

        io.to(`user_${borrow.user_id}`).emit("newNotification", rows[0]);
      }

      console.log("✅ Daily notification job complete");
    } catch (err) {
      console.error("❌ Notification Cron Error:", err);
    }
  });
};