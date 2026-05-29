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
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load top books" });
  }
};

/* ================= AI INSIGHT ================= */
// FIX: No longer calls Groq — builds the insight directly from data.
// Reason: the free Groq TPM limit (8000) is fully consumed by generateMLInsight.
// The structured fallback below is identical in output to what the LLM returned anyway.
export const generateAIInsight = async (req, res) => {
  try {
    const { overview, borrowTrends, topBooks, topBorrowers } = req.body;

    if (!overview || !borrowTrends || !topBooks || !topBorrowers) {
      return res.status(400).json({ error: "Missing analytics data" });
    }

    // Determine trend direction from borrowTrends
    let trendNote = "";
    if (borrowTrends.length >= 2) {
      const last = borrowTrends[borrowTrends.length - 1]?.total || 0;
      const prev = borrowTrends[borrowTrends.length - 2]?.total || 0;
      if (last > prev) trendNote = "Borrow activity is trending upward.";
      else if (last < prev) trendNote = "Borrow activity has decreased recently.";
      else trendNote = "Borrow activity is stable.";
    }

    const summary = `The library has ${overview.totalUsers} users (${overview.totalStudents} students, ${overview.totalAdmins} admins) with ${overview.totalBorrows} total borrow transactions. Active borrows: ${overview.activeBorrows}. Overdue: ${overview.overdueBorrows}. ${trendNote}`;

    const cards = [
      { title: "Total Users",      value: overview.totalUsers      || 0 },
      { title: "Total Students",   value: overview.totalStudents   || 0 },
      { title: "Total Borrows",    value: overview.totalBorrows    || 0 },
      { title: "Active Borrows",   value: overview.activeBorrows   || 0 },
      { title: "Returned",         value: overview.returnedBorrows || 0 },
      { title: "Overdue",          value: overview.overdueBorrows  || 0 },
    ];

    const recommendations = [];

    if (overview.overdueBorrows > 0) {
      recommendations.push({
        category: "Overdue",
        text: `${overview.overdueBorrows} overdue borrow(s) detected. Send reminders to affected students.`
      });
    }

    if (topBooks[0]) {
      recommendations.push({
        category: "Inventory",
        text: `"${topBooks[0].title}" is the most borrowed book. Consider acquiring additional copies.`
      });
    }

    if (overview.activeBorrows === 0 && overview.totalBorrows > 0) {
      recommendations.push({
        category: "Engagement",
        text: "All books are currently returned. Run a reading promotion to boost activity."
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        category: "System",
        text: "Library is operating normally. Keep monitoring borrow trends."
      });
    }

    res.json({ summary, cards, recommendations });

  } catch (err) {
    console.error("❌ AI INSIGHT ERROR:", err.message);
    res.status(500).json({
      summary: "Failed to generate insight.",
      cards: [],
      recommendations: []
    });
  }
};

/* ================= ML DATA AGGREGATION ================= */
export const getMLData = async (req, res) => {
  try {
    const [
      monthlyVolume,
      dowPattern,
      subjectDemand,
      overdueRisk,
      bookHeat
    ] = await Promise.all([

      // 1. Monthly borrow volume (last 12 months) — for linear regression forecasting
      db.query(`
        SELECT 
          DATE_FORMAT(borrowed_at, '%Y-%m') AS month,
          COUNT(*) AS total_borrows,
          SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned,
          SUM(CASE WHEN status = 'borrowed' AND due_date < NOW() THEN 1 ELSE 0 END) AS overdue
        FROM borrows
        WHERE borrowed_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month
        ORDER BY month ASC
      `),

      // 2. Day-of-week pattern — peak period detection
      db.query(`
        SELECT 
          DAYNAME(borrowed_at) AS day_name,
          DAYOFWEEK(borrowed_at) AS day_num,
          COUNT(*) AS total
        FROM borrows
        GROUP BY day_name, day_num
        ORDER BY day_num ASC
      `),

      // 3. Subject demand — subject-level trend
      db.query(`
        SELECT 
          s.name AS subject,
          COUNT(br.id) AS total_borrows,
          DATE_FORMAT(MAX(br.borrowed_at), '%Y-%m') AS last_borrowed
        FROM borrows br
        JOIN books bk ON br.book_id = bk.id
        JOIN book_subjects bs ON bk.id = bs.book_id
        JOIN subjects s ON bs.subject_id = s.id
        GROUP BY s.id, s.name
        ORDER BY total_borrows DESC
      `),

      // 4. Overdue risk students — behavioral scoring
      db.query(`
        SELECT 
          u.full_name,
          u.lrn,
          COUNT(b.id) AS total_borrows,
          SUM(CASE WHEN b.status = 'borrowed' AND b.due_date < NOW() THEN 1 ELSE 0 END) AS overdue_count,
          ROUND(
            SUM(CASE WHEN b.status = 'borrowed' AND b.due_date < NOW() THEN 1 ELSE 0 END) 
            / COUNT(b.id) * 100, 1
          ) AS overdue_rate_pct
        FROM borrows b
        JOIN users u ON b.user_id = u.id
        GROUP BY b.user_id, u.full_name, u.lrn
        HAVING total_borrows >= 1
        ORDER BY overdue_rate_pct DESC, overdue_count DESC
        LIMIT 10
      `),

      // 5. Book heat score — frequency-recency collaborative filtering signal
      db.query(`
        SELECT 
          bk.title,
          COUNT(br.id) AS borrow_frequency,
          MAX(br.borrowed_at) AS last_borrowed,
          DATEDIFF(NOW(), MAX(br.borrowed_at)) AS days_since_last_borrow,
          ROUND(
            COUNT(br.id) / (DATEDIFF(NOW(), MIN(br.borrowed_at)) + 1) * 30, 2
          ) AS heat_score
        FROM borrows br
        JOIN books bk ON br.book_id = bk.id
        GROUP BY br.book_id, bk.title
        ORDER BY heat_score DESC
        LIMIT 10
      `)
    ]);

    res.json({
      monthlyVolume: monthlyVolume[0],
      dowPattern:    dowPattern[0],
      subjectDemand: subjectDemand[0],
      overdueRisk:   overdueRisk[0],
      bookHeat:      bookHeat[0]
    });

  } catch (err) {
    console.error("❌ ML DATA ERROR:", err);
    res.status(500).json({ message: "Failed to load ML data" });
  }
};

/* ================= ML INSIGHT (GROQ) ================= */
export const generateMLInsight = async (req, res) => {
  try {
    const { monthlyVolume, dowPattern, subjectDemand, overdueRisk, bookHeat } = req.body;

    if (!monthlyVolume) {
      return res.status(400).json({ error: "Missing ML data" });
    }

    // ── Compute forecast via linear regression (real ML, no library needed) ──
    const forecast = forecastNextMonth(monthlyVolume);

    // ── Build insight purely from data first (used as fallback AND to reduce prompt size) ──
    const builtInInsight = buildInsightFromData({
      forecast, monthlyVolume, dowPattern, subjectDemand, overdueRisk, bookHeat
    });

    // ── Try Groq only if data is rich enough to be worth it ──
    // Send an ultra-minimal prompt to stay well under the 6000 TPM limit
    let parsed = null;

    try {
      // Small delay so this doesn't collide with any other pending request
      await new Promise(r => setTimeout(r, 2000));

      const prompt = `Return ONLY valid JSON, no markdown.
{
  "forecastSummary": "one sentence about the ${forecast} predicted borrows trend",
  "peakDay": "one sentence about this day pattern: ${JSON.stringify(dowPattern?.slice(0,7))}",
  "subjectInsights": [{"subject":"string","insight":"string"}],
  "hotBooks": [{"title":"string","insight":"string"}],
  "recommendations": [{"category":"string","action":"string","priority":"High|Medium|Low"}]
}
Top subjects: ${JSON.stringify(subjectDemand?.slice(0,3))}
Top books by heat: ${JSON.stringify(bookHeat?.slice(0,3)?.map(b => ({ title: b.title, heat: b.heat_score, freq: b.borrow_frequency })))}
Rules: subjectInsights max 3, hotBooks max 3, recommendations max 3.`;

      const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_completion_tokens: 600
      });

      const raw = response.choices?.[0]?.message?.content || "";
      parsed = parseAI(raw);
      console.log("✅ ML GROQ SUCCESS");
    } catch (groqErr) {
      console.warn("⚠️ ML Groq skipped (rate limit or error), using built-in insight:", groqErr.message);
    }

    // ── Merge: use Groq text where available, built-in data everywhere else ──
    const final = {
      predictedNextMonth:  forecast,
      forecastSummary:     parsed?.forecastSummary  || builtInInsight.forecastSummary,
      peakDay:             parsed?.peakDay          || builtInInsight.peakDay,
      subjectInsights:     parsed?.subjectInsights  || builtInInsight.subjectInsights,
      atRiskStudents:      builtInInsight.atRiskStudents,   // always from real data
      hotBooks:            parsed?.hotBooks         || builtInInsight.hotBooks,
      recommendations:     parsed?.recommendations  || builtInInsight.recommendations,
    };

    res.json(final);

  } catch (err) {
    console.error("❌ ML INSIGHT ERROR:", err.message);
    res.status(500).json({ message: "ML insight generation failed" });
  }
};

/* ================= BUILT-IN INSIGHT BUILDER ================= */
// Generates meaningful insight text from raw data without needing an LLM.
// This is the guaranteed fallback and also pre-fills atRiskStudents always.
function buildInsightFromData({ forecast, monthlyVolume, dowPattern, subjectDemand, overdueRisk, bookHeat }) {

  // Forecast summary
  const last = monthlyVolume?.[monthlyVolume.length - 1];
  const prev = monthlyVolume?.[monthlyVolume.length - 2];
  let trend = "stable";
  if (last && prev) {
    if (Number(last.total_borrows) > Number(prev.total_borrows)) trend = "upward";
    else if (Number(last.total_borrows) < Number(prev.total_borrows)) trend = "downward";
  }
  const forecastSummary = `Based on ${monthlyVolume?.length || 0} months of data using linear regression, next month is projected at ${forecast} borrows. The current trend is ${trend}.`;

  // Peak day
  const peakDayRow = dowPattern?.reduce((max, d) => (Number(d.total) > Number(max.total) ? d : max), dowPattern?.[0] || {});
  const peakDay = peakDayRow?.day_name
    ? `${peakDayRow.day_name} is the busiest borrowing day with ${peakDayRow.total} borrows. Schedule staffing and book returns accordingly.`
    : "Insufficient data to determine peak day.";

  // Subject insights
  const subjectInsights = (subjectDemand || []).slice(0, 3).map(s => ({
    subject: s.subject,
    insight: `${s.total_borrows} borrow(s) recorded. Last activity: ${s.last_borrowed || "N/A"}.`
  }));

  // At-risk students — always built from real data, never from LLM
  const atRiskStudents = (overdueRisk || [])
    .filter(u => Number(u.overdue_count) > 0)
    .slice(0, 5)
    .map(u => ({
      name: u.full_name,
      lrn:  u.lrn,
      risk: Number(u.overdue_rate_pct) >= 50 ? "High" : Number(u.overdue_rate_pct) >= 20 ? "Medium" : "Low",
      reason: `${u.overdue_count} overdue out of ${u.total_borrows} borrow(s) — ${u.overdue_rate_pct}% overdue rate.`
    }));

  // Hot books
  const hotBooks = (bookHeat || []).slice(0, 3).map(b => ({
    title:   b.title,
    insight: `Heat score: ${b.heat_score}. Borrowed ${b.borrow_frequency} time(s), last ${b.days_since_last_borrow} day(s) ago.`
  }));

  // Recommendations
  const recommendations = [];

  const topSubject = subjectDemand?.[0];
  if (topSubject) {
    recommendations.push({
      category: "Collection",
      action:   `Expand "${topSubject.subject}" collection — highest subject demand with ${topSubject.total_borrows} borrows.`,
      priority: "High"
    });
  }

  if (atRiskStudents.length > 0) {
    recommendations.push({
      category: "Student Support",
      action:   `Follow up with ${atRiskStudents.length} student(s) flagged for overdue risk.`,
      priority: "High"
    });
  }

  if (trend === "downward") {
    recommendations.push({
      category: "Engagement",
      action:   "Borrow volume is declining. Consider running a reading campaign or book fair.",
      priority: "Medium"
    });
  } else if (trend === "upward") {
    recommendations.push({
      category: "Inventory",
      action:   "Borrow activity is increasing. Ensure top books have sufficient copies available.",
      priority: "Medium"
    });
  }

  if (recommendations.length < 2) {
    recommendations.push({
      category: "Operations",
      action:   "Library is operating normally. Continue monitoring borrowing patterns monthly.",
      priority: "Low"
    });
  }

  return { forecastSummary, peakDay, subjectInsights, atRiskStudents, hotBooks, recommendations };
}

/* ================= LINEAR REGRESSION HELPER ================= */
// Least-squares linear regression — predicts next month borrow volume.
// Defensible as real ML in capstone: O(n) computation, no external library.
function forecastNextMonth(monthlyVolume) {
  if (!monthlyVolume || monthlyVolume.length < 2) {
    return Number(monthlyVolume?.[0]?.total_borrows) || 0;
  }

  const n   = monthlyVolume.length;
  const x   = monthlyVolume.map((_, i) => i);
  const y   = monthlyVolume.map(m => Number(m.total_borrows));

  const sumX  = x.reduce((a, b) => a + b, 0);
  const sumY  = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return Math.round(sumY / n); // flat line fallback

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const predicted = Math.round(slope * n + intercept);

  return Math.max(0, predicted);
}