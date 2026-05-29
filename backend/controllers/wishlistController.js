import db from "../db/db.js";

// Add book to wishlist
export const addToWishlist = async (req, res) => {
  const userId = req.user.id;
  const { book_id } = req.body;
  try {
    await db.query(
      `INSERT IGNORE INTO wishlist (user_id, book_id) VALUES (?, ?)`,
      [userId, book_id]
    );
    res.json({ message: "Added to wishlist" });
  } catch (err) {
    console.error("Add wishlist error:", err);
    res.status(500).json({ message: "Failed to add to wishlist" });
  }
};

// Remove book from wishlist
export const removeFromWishlist = async (req, res) => {
  const userId = req.user.id;
  const { bookId } = req.params;
  try {
    await db.query(
      `DELETE FROM wishlist WHERE user_id = ? AND book_id = ?`,
      [userId, bookId]
    );
    res.json({ message: "Removed from wishlist" });
  } catch (err) {
    console.error("Remove wishlist error:", err);
    res.status(500).json({ message: "Failed to remove from wishlist" });
  }
};

// Check if book is in wishlist
export const checkWishlist = async (req, res) => {
  const userId = req.user.id;
  const { bookId } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT * FROM wishlist WHERE user_id = ? AND book_id = ?`,
      [userId, bookId]
    );
    res.json({ inWishlist: rows.length > 0 });
  } catch (err) {
    console.error("Check wishlist error:", err);
    res.status(500).json({ message: "Failed to check wishlist" });
  }
};

// Notify users when a book becomes available
export const notifyWishlistUsers = async (book_id, io) => {
  try {
    // Get users who wishlisted this book
    const [users] = await db.query(
      `SELECT user_id FROM wishlist WHERE book_id = ?`,
      [book_id]
    );

    if (users.length === 0) return;

    // Get book title
    const [[book]] = await db.query(
      `SELECT title FROM books WHERE id = ?`,
      [book_id]
    );

    for (const u of users) {
      // Insert notification
      const [result] = await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES (?, ?, ?, 'wishlist')`,
        [u.user_id, "Book Available", `"${book.title}" is now available`,]
      );

      // Emit Socket.IO
      io.to(`user_${u.user_id}`).emit("newNotification", {
        id: result.insertId,
        user_id: u.user_id,
        title: "Book Available",
        message: `"${book.title}" is now available`,
        type: "wishlist",
        is_read: false,
        created_at: new Date()
      });

      // Remove from wishlist after notifying
      await db.query(`DELETE FROM wishlist WHERE user_id = ? AND book_id = ?`, [
        u.user_id,
        book_id
      ]);
    }
  } catch (err) {
    console.error("Wishlist notification error:", err);
  }
};