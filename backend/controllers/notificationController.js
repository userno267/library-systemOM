import db from "../db/db.js";

// Get all notifications
export const getNotifications = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = ? AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({ count: row.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

// Mark single as read
export const markAsRead = async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = ?`,
      [req.user.id]
    );

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notifications" });
  }
};


export const getUserNotifications = async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

export const sendAdminNotification = async (req, res) => {
  try {
    const { title, message, userId } = req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const io = req.app.get("io");

    // =========================
    // SINGLE USER
    // =========================
    if (userId) {
      const [result] = await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES (?, ?, ?, 'admin')`,
        [userId, title, message]
      );

      const [rows] = await db.query(
        `SELECT * FROM notifications WHERE id = ?`,
        [result.insertId]
      );

      io.to(`user_${userId}`).emit("newNotification", rows[0]);

      return res.json({ message: "Notification sent to user" });
    }

    // =========================
    // ALL USERS
    // =========================
    const [users] = await db.query(
      `SELECT id FROM users WHERE role = 'student'`
    );

    for (const user of users) {
      const [result] = await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES (?, ?, ?, 'admin')`,
        [user.id, title, message] // ✅ FIX HERE
      );

      const [rows] = await db.query(
        `SELECT * FROM notifications WHERE id = ?`,
        [result.insertId]
      );

      io.to(`user_${user.id}`).emit("newNotification", rows[0]); // ✅ FIX HERE
    }

    res.json({ message: "Notification sent to all students" });

  } catch (err) {
    console.error("Admin notification error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

