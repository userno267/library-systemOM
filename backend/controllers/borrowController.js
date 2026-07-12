import db from "../db/db.js";
import { notifyWishlistUsers } from "./wishlistController.js"; // ✅ add this

export const borrowBook = async (req, res) => {
  const userId = req.user.id;
  const { book_id } = req.body;
  const io = req.app.get("io");

  try {
    const [[book]] = await db.query("SELECT * FROM books WHERE id = ?", [book_id]);
    if (!book) return res.status(404).json({ message: "Book not found" });

    // ✅ CHECK UNPAID FINES FIRST
    const [[{ unpaidFines }]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS unpaidFines
       FROM fines
       WHERE user_id = ? AND status = 'unpaid'`,
      [userId]
    );

    if (unpaidFines > 0) {
      return res.status(400).json({ 
        message: `You have an unpaid fine of ₱${unpaidFines}. Please pay your fine before borrowing.`,
        hasFine: true,
        fineAmount: unpaidFines
      });
    }

    const [[active]] = await db.query(
      `SELECT * FROM borrows WHERE user_id = ? AND book_id = ? AND returned_at IS NULL`,
      [userId, book_id]
    );
    if (active) return res.status(400).json({ message: "Book already borrowed" });

    if (book.type === "physical" && book.copies <= 0) {
      return res.status(400).json({ message: "Book out of stock" });
    }

    // ✅ CHANGED FROM 7 TO 3 DAYS
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    await db.query(
      `INSERT INTO borrows (user_id, book_id, due_date, status) 
       VALUES (?, ?, ?, 'pending_borrow')`,
      [userId, book_id, dueDate]
    );

    io.to(`user_${userId}`).emit("borrowUpdate", {
      bookId: book_id,
      action: "pending_borrow",
      message: `Borrow request sent for "${book.title}"`,
    });

    io.to("user_admins").emit("borrowUpdate", {
      bookId: book_id,
      userId,
      action: "pending_borrow",
      message: `User ${userId} requested to borrow "${book.title}"`,
    });

    res.json({ message: "Borrow request sent" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Borrow failed" });
  }
};
export const returnBook = async (req, res) => {
  const userId = req.user.id;
  const { book_id } = req.body;
  const io = req.app.get("io");

  try {
    const [[borrow]] = await db.query(
      `SELECT * FROM borrows 
       WHERE user_id = ? AND book_id = ? AND returned_at IS NULL`,
      [userId, book_id]
    );

    if (!borrow) {
      return res.status(400).json({ message: "No active borrow found" });
    }

    await db.query(
      `UPDATE borrows 
       SET status = 'pending_return' 
       WHERE id = ?`,
      [borrow.id]
    );

    io.to(`user_${userId}`).emit("borrowUpdate", {
      bookId: book_id,
      action: "pending_return",
      message: `Return request sent`,
    });

    io.to("user_admins").emit("borrowUpdate", {
      bookId: book_id,
      userId,
      action: "pending_return",
      message: `User ${userId} requested return`,
    });

    res.json({ message: "Return request sent" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Return failed" });
  }
};
export const getBorrowHistory = async (req, res) => {
  const userId = req.user.id;
console.log("USER:", req.user);
  try {
    const [rows] = await db.query(
      `SELECT b.*, bk.title, bk.cover_image
       FROM borrows b
       JOIN books bk ON b.book_id = bk.id
       WHERE b.user_id = ?
       ORDER BY b.borrowed_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
};
// borrowController.js

export const getBorrowHistoryByUser = async (req, res) => {
  const { userId } = req.params; // from URL

  try {
    const [rows] = await db.query(
      `SELECT b.*, bk.title, bk.type, bk.cover_image
       FROM borrows b
       JOIN books bk ON b.book_id = bk.id
       WHERE b.user_id = ?
       ORDER BY b.borrowed_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch borrow history" });
  }
};
export const adminBorrowBook = async (req, res) => {
  const { user_id, book_id } = req.body;
  const io = req.app.get("io");

  try {
    if (!user_id || !book_id) {
      return res.status(400).json({ message: "Missing user or book" });
    }

    const [[book]] = await db.query(
      "SELECT * FROM books WHERE id = ?",
      [book_id]
    );

    if (!book) return res.status(404).json({ message: "Book not found" });

    const [[active]] = await db.query(
      `SELECT * FROM borrows 
       WHERE user_id = ? AND book_id = ? AND returned_at IS NULL`,
      [user_id, book_id]
    );

    if (active) {
      return res.status(400).json({ message: "Already borrowed" });
    }

    if (book.type === "physical" && book.copies <= 0) {
      return res.status(400).json({ message: "Out of stock" });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    // ✅ FIX: set status directly to 'borrowed'
    await db.query(
      `INSERT INTO borrows (user_id, book_id, due_date, status)
       VALUES (?, ?, ?, 'borrowed')`,
      [user_id, book_id, dueDate]
    );

    // update stock
    if (book.type === "physical") {
      const newCopies = book.copies - 1;
      const status = newCopies === 0 ? "unavailable" : "available";

      await db.query(
        "UPDATE books SET copies=?, status=? WHERE id=?",
        [newCopies, status, book_id]
      );
    }

    // socket
    io.to(`user_${user_id}`).emit("borrowUpdate", {
      bookId: book_id,
      action: "borrowed",
      message: `Book borrowed by admin`
    });

    io.to("user_admins").emit("borrowUpdate", {
      bookId: book_id,
      userId: user_id,
      action: "borrowed",
      message: `Admin borrowed book for user ${user_id}`
    });

    res.json({ message: "Admin borrow success" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Admin borrow failed" });
  }
};

/* ===========================
   GET ACTIVE BORROWS
=========================== */
export const getActiveBorrows = async (req, res) => {
  const { page = 1, limit = 10, search = "", status = "" } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  try {
    let where = "WHERE b.returned_at IS NULL";
    const params = [];

    // STATUS FILTER (optional but needed for your frontend dropdown)
    if (status) {
      where += " AND b.status = ?";
      params.push(status);
    }

    // SEARCH FILTER
    if (search) {
      where += `
        AND (
          u.full_name LIKE ?
          OR u.lrn LIKE ?
          OR bk.title LIKE ?
        )
      `;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // MAIN DATA
    const [rows] = await db.query(
      `
      SELECT 
        b.id,
        b.user_id,
        b.book_id,
        b.due_date,
        b.status,
        u.full_name,
        u.lrn,
        bk.title
      FROM borrows b
      JOIN users u ON u.id = b.user_id
      JOIN books bk ON bk.id = b.book_id
      ${where}
      ORDER BY b.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    // COUNT QUERY
    const [[count]] = await db.query(
      `
      SELECT COUNT(*) as total
      FROM borrows b
      JOIN users u ON u.id = b.user_id
      JOIN books bk ON bk.id = b.book_id
      ${where}
      `,
      params
    );

    return res.json({
      borrows: rows,
      page: pageNum,
      totalPages: Math.ceil(count.total / limitNum),
      total: count.total,
    });

  } catch (err) {
    console.error("ACTIVE BORROWS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const adminReturnBook = async (req, res) => {
  const { borrow_id } = req.body;
  const io = req.app.get("io");

  try {
    // 1. Get borrow record
    const [[borrow]] = await db.query(
      `SELECT * FROM borrows WHERE id = ? AND returned_at IS NULL`,
      [borrow_id]
    );

    if (!borrow) {
      return res.status(400).json({ message: "No active borrow found" });
    }

    const userId = borrow.user_id;
    const bookId = borrow.book_id;

    // 2. Mark as returned
    await db.query(
      `UPDATE borrows 
       SET returned_at = NOW(), status = 'returned' 
       WHERE id = ?`,
      [borrow_id]
    );

    // 3. Get book info
    const [[book]] = await db.query(
      `SELECT id, type, copies, title FROM books WHERE id = ?`,
      [bookId]
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // 4. Update copies (ONLY for physical books)
    let newCopies = book.copies;

    if (book.type === "physical") {
      newCopies = book.copies + 1;

      await db.query(
        `UPDATE books 
         SET copies = ?, status = 'available' 
         WHERE id = ?`,
        [newCopies, bookId]
      );

      // 5. Wishlist notification trigger
      if (book.copies === 0 && newCopies > 0) {
        await notifyWishlistUsers(bookId, io);
      }
    }

    // 6. SOCKET EVENTS (ADMIN + USER)

    // user room
    io.to(`user_${userId}`).emit("borrowUpdate", {
      bookId,
      action: "returned",
      message: `You returned "${book.title}"`
    });

    // admin room
    io.to("user_admins").emit("borrowUpdate", {
      bookId,
      userId,
      action: "returned",
      message: `User ${userId} returned "${book.title}"`
    });

    return res.json({
      message: "Book returned successfully",
      newCopies
    });
  } catch (err) {
    console.error("ADMIN RETURN ERROR:", err);
    res.status(500).json({ message: "Return failed" });
  }
};
export const approveBorrow = async (req, res) => {
  const { borrow_id } = req.body;
  const io = req.app.get("io");

  try {
    const [[borrow]] = await db.query(
      `SELECT * FROM borrows WHERE id=? AND status='pending_borrow'`,
      [borrow_id]
    );

    if (!borrow) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // ✅ CHECK UNPAID FINES
    const [[{ unpaidFines }]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS unpaidFines
       FROM fines
       WHERE user_id = ? AND status = 'unpaid'`,
      [borrow.user_id]
    );

    if (unpaidFines > 0) {
      return res.status(400).json({ 
        message: `User has an unpaid fine of ₱${unpaidFines}. Fine must be paid before approving.`,
        hasFine: true,
        fineAmount: unpaidFines
      });
    }

    const [[book]] = await db.query(
      `SELECT * FROM books WHERE id=?`,
      [borrow.book_id]
    );

    if (book.type === "physical" && book.copies <= 0) {
      return res.status(400).json({ message: "Out of stock" });
    }

    await db.query(
      `UPDATE borrows SET status='borrowed' WHERE id=?`,
      [borrow_id]
    );

    if (book.type === "physical") {
      const newCopies = book.copies - 1;
      const status = newCopies === 0 ? "unavailable" : "available";
      await db.query(
        `UPDATE books SET copies=?, status=? WHERE id=?`,
        [newCopies, status, book.id]
      );
    }

    io.to(`user_${borrow.user_id}`).emit("borrowUpdate", {
      bookId: book.id,
      action: "approved",
      message: "Borrow approved"
    });

    res.json({ message: "Borrow approved" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error approving borrow" });
  }
};
export const approveReturn = async (req, res) => {
  const { borrow_id } = req.body;
  const io = req.app.get("io");

  try {
    const [[borrow]] = await db.query(
      `SELECT * FROM borrows WHERE id=? AND status='pending_return'`,
      [borrow_id]
    );

    if (!borrow) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const [[book]] = await db.query(
      `SELECT * FROM books WHERE id=?`,
      [borrow.book_id]
    );

    await db.query(
      `UPDATE borrows 
       SET status='returned', returned_at=NOW() 
       WHERE id=?`,
      [borrow_id]
    );

    if (book.type === "physical") {
      const newCopies = book.copies + 1;

      await db.query(
        `UPDATE books SET copies=?, status='available' WHERE id=?`,
        [newCopies, book.id]
      );

      // ✅ Wishlist notification
      if (book.copies === 0 && newCopies > 0) {
        await notifyWishlistUsers(book.id, io);
      }
    }

    io.to(`user_${borrow.user_id}`).emit("borrowUpdate", {
      bookId: book.id,
      action: "returned",
      message: "Return approved"
    });

    io.to("user_admins").emit("borrowUpdate", {
      bookId: book.id,
      userId: borrow.user_id,
      action: "returned",
      message: `User ${borrow.user_id} return approved`
    });

    res.json({ message: "Return approved" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error approving return" });
  }
};

export const rejectRequest = async (req, res) => {
  const { borrow_id } = req.body;

  try {
    await db.query(
      `UPDATE borrows SET status='rejected' WHERE id=?`,
      [borrow_id]
    );

    res.json({ message: "Request rejected" });

  } catch (err) {
    res.status(500).json({ message: "Error rejecting" });
  }
};