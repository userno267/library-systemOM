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
  // ROW_NUMBER + PARTITION BY book_id keeps only the best-scoring row per book,
  // in case recommendation_cache has duplicate (user_id, book_id) rows —
  // see note in recommendationCron.js about the missing unique constraint.
  const [rows] = await db.query(
    `SELECT book_id, score, reason, computed_at, title, author, cover_image, section, copies
     FROM (
       SELECT
         rc.book_id,
         rc.score,
         rc.reason,
         rc.computed_at,
         b.title,
         b.author,
         b.cover_image,
         b.section,
         b.copies,
         ROW_NUMBER() OVER (
           PARTITION BY rc.book_id
           ORDER BY rc.score DESC, rc.computed_at DESC
         ) AS rn
       FROM recommendation_cache rc
       INNER JOIN books b ON b.id = rc.book_id
       WHERE rc.user_id = ?
         AND rc.computed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ) ranked
     WHERE rn = 1
     ORDER BY score DESC
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

// ─── Similar books (book detail page) ─────────────────────────────────────────
//
// Cheap, synchronous, no Python/ML involved — safe to call on every page view.
// Mixes:
//   1) a couple of this user's already-cached personalized picks (if any),
//   2) filled out with same section / shared-subject books,
// capped at SIMILAR_LIMIT total.

const SIMILAR_LIMIT       = 5;
const SIMILAR_FROM_CACHE  = 2; // how many of the 5 slots can come from personalized cache

export const getSimilarBooks = async (req, res) => {
  const bookId = Number(req.params.id);
  const userId = req.user?.id;

  if (!bookId) {
    return res.status(400).json({ message: "Invalid book id" });
  }

  try {
    const [[book]] = await db.query(
      `SELECT id, section FROM books WHERE id = ?`,
      [bookId]
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // 1️⃣  Personalized: this user's cached recs, excluding the book being viewed
    let personalized = [];
    if (userId) {
      // ROW_NUMBER + PARTITION BY book_id ensures the same book can't be
      // picked twice even if recommendation_cache has duplicate rows for it.
      const [rows] = await db.query(
        `SELECT book_id, title, author, cover_image, section, copies, reason
         FROM (
           SELECT
             rc.book_id,
             rc.score,
             b.title,
             b.author,
             b.cover_image,
             b.section,
             b.copies,
             'cached' AS reason,
             ROW_NUMBER() OVER (
               PARTITION BY rc.book_id
               ORDER BY rc.score DESC
             ) AS rn
           FROM recommendation_cache rc
           INNER JOIN books b ON b.id = rc.book_id
           WHERE rc.user_id = ?
             AND rc.book_id != ?
         ) ranked
         WHERE rn = 1
         ORDER BY score DESC
         LIMIT ?`,
        [userId, bookId, SIMILAR_FROM_CACHE]
      );
      personalized = rows;
    }

    // 2️⃣  Fill remaining slots with same section / shared subjects
    const remaining  = SIMILAR_LIMIT - personalized.length;
    const excludeIds = [bookId, ...personalized.map((r) => r.book_id)];

    let sameSection = [];
    if (remaining > 0) {
      // Uses EXISTS instead of a LEFT JOIN to book_subjects so each book
      // produces exactly one row — no fan-out, no DISTINCT needed.
      // (DISTINCT + ORDER BY RAND() on fanned-out rows is a known MySQL
      // gotcha that can let duplicate book_ids slip past LIMIT.)
      const [rows] = await db.query(
        `SELECT
           b.id AS book_id,
           b.title,
           b.author,
           b.cover_image,
           b.section,
           b.copies,
           'section' AS reason
         FROM books b
         WHERE b.id NOT IN (?)
           AND (
             b.section = ?
             OR EXISTS (
               SELECT 1 FROM book_subjects bs1
               WHERE bs1.book_id = b.id
                 AND bs1.subject_id IN (
                   SELECT subject_id FROM book_subjects WHERE book_id = ?
                 )
             )
           )
         ORDER BY (b.copies = 0), RAND()
         LIMIT ?`,
        [excludeIds, book.section, bookId, remaining]
      );
      sameSection = rows;
    }

    // Defensive de-dupe regardless of query-level cause — never show the
    // same book_id twice in one response.
    const seen = new Set();
    const similar = [...personalized, ...sameSection]
      .filter((b) => {
        if (seen.has(b.book_id)) return false;
        seen.add(b.book_id);
        return true;
      })
      .slice(0, SIMILAR_LIMIT);

    res.json({ similar });

  } catch (err) {
    console.error("[SimilarBooks] Error:", err);
    res.status(500).json({ message: "Failed to fetch similar books" });
  }
};