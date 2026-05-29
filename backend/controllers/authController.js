import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db/db.js";

export const register = async (req, res) => {
  const { full_name, lrn, email, password } = req.body;

  if (!full_name || !lrn || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (full_name, lrn, email, password) VALUES (?, ?, ?, ?)",
      [full_name, lrn, email, hashed]
    );

    res.status(201).json({
      success: true,
      message: "Registration successful"
    });

  } catch (err) {
    // Duplicate entry (MySQL error code)
    if (err.code === "ER_DUP_ENTRY") {
      if (err.message.includes("lrn")) {
        return res.status(409).json({
          success: false,
          message: "LRN already registered"
        });
      }

      if (err.message.includes("email")) {
        return res.status(409).json({
          success: false,
          message: "Email already registered"
        });
      }
    }

    console.error("REGISTER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
};
export const login = async (req, res) => {
  const { lrn, password } = req.body;

  if (!lrn || !password) {
    return res.status(400).json({
      success: false,
      message: "LRN and password are required"
    });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE lrn = ?",
      [lrn]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.full_name,
        role: user.role
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
};

