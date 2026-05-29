import pool from "../db/db.js";
import bcrypt from "bcrypt";

// ==============================
// LIST USERS (with search & pagination)
// ==============================
export const listUsers = async (req, res) => {
  const { page = 1, limit = 10, search = "", role = "" } = req.query;
  const offset = (page - 1) * limit;

  try {
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      where += " AND (full_name LIKE ? OR email LIKE ? OR lrn LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      where += " AND role = ?";
      params.push(role);
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, lrn, email, role, created_at 
       FROM users ${where} 
       ORDER BY id DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params
    );

    res.json({
      users: rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("LIST USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// GET SINGLE USER
// ==============================
export const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT 
         id, 
         full_name, 
         lrn, 
         email, 
         role, 
         phone,
         bio,
         profile_image,
         created_at 
       FROM users 
       WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("GET USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// CREATE USER
// ==============================
export const createUser = async (req, res) => {
  const { full_name, lrn, email, password, role } = req.body;

  if (!full_name || !lrn || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (full_name, lrn, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [full_name, lrn, email, hashed, role]
    );

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "LRN or Email already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// UPDATE USER
// ==============================
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, lrn, email, password, role } = req.body;

  try {
    const updates = [];
    const params = [];

    if (full_name) { updates.push("full_name = ?"); params.push(full_name); }
    if (lrn) { updates.push("lrn = ?"); params.push(lrn); }
    if (email) { updates.push("email = ?"); params.push(email); }
    if (role) { updates.push("role = ?"); params.push(role); }
    if (password) { 
      const hashed = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      params.push(hashed);
    }

    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });

    params.push(id);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "LRN or Email already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// DELETE USER
// ==============================
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, bio } = req.body;

    let profileImagePath = null;

    if (req.file) {
      profileImagePath = `/uploads/profile/${req.file.filename}`;
    }

    await pool.query(   // ✅ CHANGE db -> pool
      `UPDATE users 
       SET full_name = ?, 
           phone = ?, 
           bio = ?, 
           profile_image = COALESCE(?, profile_image)
       WHERE id = ?`,
      [name, phone, bio, profileImagePath, userId]
    );

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};


export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, bio, profile_image
       FROM users
       WHERE id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load profile" });
  }
};export const bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;

    console.log("🗑️ Incoming IDs:", ids);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const [result] = await pool.query(
      `DELETE FROM users WHERE id IN (?)`,
      [ids]
    );

    console.log("🧾 DB Result:", result);

    const deletedCount = result.affectedRows;

    if (deletedCount === 0) {
      console.warn("⚠️ No users deleted. Possible causes:");
      console.warn("- IDs do not exist");
      console.warn("- IDs are strings instead of numbers");
      console.warn("- Wrong DB connection/table");

      return res.status(404).json({
        success: false,
        deleted: 0,
        message: "No users were deleted",
      });
    }

    res.json({
      success: true,
      deleted: deletedCount,
      requested: ids.length,
      message: `${deletedCount} users deleted`,
    });

  } catch (err) {
    console.error("❌ BULK DELETE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};