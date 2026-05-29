// controllers/dashboardController.js

import db from "../db/db.js";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ================= JSON HELPERS ================= */
function extractJSON(text) {
  if (!text) return null;

  text = text.replace(/```json|```/g, "").trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) return null;

  return text.substring(start, end + 1);
}

function repairJSON(text) {
  if (!text) return text;

  return text
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}

function parseAI(text) {
  try {
    const extracted = extractJSON(text);
    const repaired = repairJSON(extracted);
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

/* ================= OVERVIEW ================= */
export const getOverview = async (req, res) => {
  try {
    const [
      users,
      students,
      admins,
      totalBorrows,
      activeBorrows,
      returnedBorrows,
      overdueBorrows
    ] = await Promise.all([
      db.query("SELECT COUNT(*) AS count FROM users"),
      db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'"),
      db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"),
      db.query("SELECT COUNT(*) AS count FROM borrows"),
      db.query("SELECT COUNT(*) AS count FROM borrows WHERE status = 'borrowed'"),
      db.query("SELECT COUNT(*) AS count FROM borrows WHERE status = 'returned'"),
      db.query(`
        SELECT COUNT(*) AS count 
        FROM borrows 
        WHERE status = 'borrowed' 
        AND due_date < NOW()
      `)
    ]);

    res.json({
      totalUsers: users[0][0].count,
      totalStudents: students[0][0].count,
      totalAdmins: admins[0][0].count,
      totalBorrows: totalBorrows[0][0].count,
      activeBorrows: activeBorrows[0][0].count,
      returnedBorrows: returnedBorrows[0][0].count,
      overdueBorrows: overdueBorrows[0][0].count
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load overview" });
  }
};

/* ================= BORROW TRENDS ================= */
export const getBorrowTrends = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        DATE_FORMAT(borrowed_at, '%Y-%m') AS month,
        COUNT(*) AS total
      FROM borrows
      GROUP BY month
      ORDER BY month ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load borrow trends" });
  }
};

/* ================= USER GROWTH ================= */
export const getUserGrowth = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS total
      FROM users
      GROUP BY month
      ORDER BY month ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load user growth" });
  }
};

/* ================= TOP BORROWERS ================= */
export const getTopBorrowers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.full_name, u.lrn, COUNT(b.id) AS total
      FROM borrows b
      JOIN users u ON b.user_id = u.id
      GROUP BY b.user_id
      ORDER BY total DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load top borrowers" });
  }
};

/* ================= TOP BOOKS ================= */
export const getTopBooks = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT b.title, COUNT(br.id) AS borrows
      FROM borrows br
      JOIN books b ON br.book_id = b.id
      GROUP BY br.book_id
      ORDER BY borrows DESC
      LIMIT 5
    `);

    console.log("📚 TOP BOOKS:", rows); // DEBUG

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load top books" });
  }
};
/* ================= AI INSIGHT ================= */
export const generateAIInsight = async (req, res) => {
  try {
    const { overview, borrowTrends, topBooks, topBorrowers } = req.body;

    if (!overview || !borrowTrends || !topBooks || !topBorrowers) {
      return res.status(400).json({ error: "Missing analytics data" });
    }

    const prompt = `
RETURN STRICT JSON ONLY.

FORMAT:
{
  "summary": "string",
  "cards": [{ "title": "string", "value": number }],
  "borrowTrends": [{ "month": "YYYY-MM", "totalBorrows": number, "returned": number, "overdue": number }],
  "topBooks": [{ "title": "string", "borrows": number }],
  "recommendations": [{ "category": "string", "text": "string" }]
}

DATA:
${JSON.stringify({ overview, borrowTrends, topBooks, topBorrowers })}
`;

    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_completion_tokens: 2000
    });

    const raw = response.choices?.[0]?.message?.content || "";

    let parsed = parseAI(raw);

    /* ================= FALLBACK ================= */
    if (!parsed) {
      console.error("❌ AI BROKEN JSON:", raw);

      parsed = {
        summary: "AI failed. Showing system analytics.",
        cards: [
          { title: "Users", value: overview.totalUsers || 0 },
          { title: "Active Borrows", value: overview.activeBorrows || 0 },
          { title: "Overdue", value: overview.overdueBorrows || 0 }
        ],
        borrowTrends: borrowTrends.map(b => ({
          month: b.month,
          totalBorrows: b.total,
          returned: 0,
          overdue: 0
        })),
        topBooks: topBooks.map(b => ({
          title: b.title,
          borrows: b.total
        })),
        recommendations: [
          { category: "System", text: "AI output invalid. Check token limits or prompt." }
        ]
      };
    }

    res.json(parsed);

  } catch (err) {
    console.error("❌ AI ERROR:", err.message);

    res.status(500).json({
      summary: "AI failed completely.",
      cards: [],
      borrowTrends: [],
      topBooks: [],
      recommendations: []
    });
  }
};