import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db/db.js";
import { refreshForUser } from "../cron/recommendationCron.js";
import { generateVerificationCode, sendVerificationEmail } from "../services/mailer.js";

const CODE_EXPIRY_MINUTES = 10;

async function issueVerificationCode(email) {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Clear any older, unused codes for this email so only the latest is valid.
  await db.query(`DELETE FROM email_verifications WHERE email = ?`, [email]);

  await db.query(
    `INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)`,
    [email, code, expiresAt]
  );

  return code;
}

// ─── Register ─────────────────────────────────────────────────────────────────

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
      "INSERT INTO users (full_name, lrn, email, password, is_verified) VALUES (?, ?, ?, ?, 0)",
      [full_name, lrn, email, hashed]
    );

    const code = await issueVerificationCode(email);

    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      // Don't fail registration just because the email didn't send —
      // the user can hit "resend code" on the verify screen.
      console.error("EMAIL SEND ERROR:", mailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Account created. Please check your email for a verification code.",
      email
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

// ─── Verify email code ─────────────────────────────────────────────────────────

export const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: "Email and code are required"
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT * FROM email_verifications
       WHERE email = ? AND code = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, code]
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code"
      });
    }

    const record = rows[0];
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Code expired. Please request a new one."
      });
    }

    await db.query(`UPDATE users SET is_verified = 1 WHERE email = ?`, [email]);
    await db.query(`DELETE FROM email_verifications WHERE email = ?`, [email]);

    res.json({
      success: true,
      message: "Email verified! You can now log in."
    });

  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
};

// ─── Resend verification code ───────────────────────────────────────────────────

export const resendCode = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  try {
    const [users] = await db.query(
      `SELECT id, is_verified FROM users WHERE email = ?`,
      [email]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "No account found with that email"
      });
    }

    if (users[0].is_verified) {
      return res.status(400).json({
        success: false,
        message: "This email is already verified"
      });
    }

    const code = await issueVerificationCode(email);
    await sendVerificationEmail(email, code);

    res.json({
      success: true,
      message: "A new verification code has been sent"
    });

  } catch (err) {
    console.error("RESEND CODE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
};

// ─── Login ─────────────────────────────────────────────────────────────────────

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

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        needsVerification: true,
        email: user.email
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    // 🔥 Fire-and-forget: warm the recommendation cache in the background.
    // Does NOT block the login response — errors are swallowed inside refreshForUser itself.
    if (user.role === "student") {
      refreshForUser(user.id).catch(() => {});
    }

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