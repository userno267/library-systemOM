// backend/controllers/recommendationController.js

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import db from "../db/db.js";
import { refreshForUser } from "../cron/recommendationCron.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ML_SCRIPT         = path.join(__dirname, "../../ml_recommender/recommender.py");
const PYTHON_CMD        = process.platform === "win32" ? "python" : "python3";
const CACHE_STALE_HOURS = 7;

// ─── Helper: read from cache ──────────────────────────────────────────────────

async function getCachedRecommendations(userId) {
  const [rows] = await db.query(
    `SELECT
       rc.book_id,
       rc.score,
       rc.reason,
       rc.computed_at,
       b.title,
       b.author,
       b.cover_image,
       b.section,
       b.copies
     FROM recommendation_cache rc
     INNER JOIN books b ON b.id = rc.book_id
     WHERE rc.user_id = ?
       AND rc.computed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY rc.score DESC
     LIMIT 20`,
    [userId, CACHE_STALE_HOURS]
  );
  return rows;
}

// ─── Helper: run Python ML live ───────────────────────────────────────────────

async function getLiveFallback(userId) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_CMD, [ML_SCRIPT, String(userId)], {
      cwd: path.dirname(ML_SCRIPT),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", async (code) => {
      if (code !== 0) {
        return reject(new Error(`Python exited ${code}: ${stderr.slice(0, 200)}`));
      }

      try {
        const raw   = stdout.trim();
        const start = raw.indexOf("[");
        const end   = raw.lastIndexOf("]");
        if (start === -1) return resolve([]);

        const recs = JSON.parse(raw.slice(start, end + 1));
        if (!recs.length) return resolve([]);

        const bookIds = recs.map((r) => r.book_id);
        const [books] = await db.query(
          `SELECT id, title, author, cover_image, section, copies
           FROM books WHERE id IN (?)`,
          [bookIds]
        );

        const bookMap  = Object.fromEntries(books.map((b) => [b.id, b]));
        const enriched = recs
          .map((r) => ({ ...r, ...bookMap[r.book_id] }))
          .filter((r) => r.title);

        resolve(enriched);
      } catch (err) {
        reject(err);
      }
    });

    proc.on("error", reject);
  });
}

// ─── Main controller ──────────────────────────────────────────────────────────

export const getRecommendations = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID required" });
  }

  try {
    // 1️⃣  Cache hit — instant
    const cached = await getCachedRecommendations(userId);
    if (cached.length > 0) {
      return res.json({
        recommendations: cached,
        source: "cache",
        cached_at: cached[0].computed_at,
      });
    }

    // 2️⃣  Cache miss — run live ML, seed cache async for next visit
    console.log(`[Recommendations] Cache miss for user ${userId}, running live ML...`);

    let live = [];
    try {
      live = await getLiveFallback(userId);
    } catch (mlErr) {
      console.error("[Recommendations] Live ML failed:", mlErr.message);
    }

    if (live.length > 0) {
      refreshForUser(userId).catch(() => {});
      return res.json({ recommendations: live, source: "live" });
    }

    // 3️⃣  Hard fallback — most borrowed books, zero ML
    const [popular] = await db.query(
      `SELECT
         b.id    AS book_id,
         b.title,
         b.author,
         b.cover_image,
         b.section,
         b.copies,
         COUNT(br.id) AS score,
         'popular'    AS reason
       FROM books b
       LEFT JOIN borrows br ON br.book_id = b.id
       GROUP BY b.id
       ORDER BY score DESC
       LIMIT 20`
    );

    return res.json({ recommendations: popular, source: "popular_fallback" });

  } catch (err) {
    console.error("[Recommendations] Unexpected error:", err);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
};