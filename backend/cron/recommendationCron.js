
import cron from "node-cron";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import db from "../db/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ML_SCRIPT  = path.join(__dirname, "../../ml_recommender/recommender.py");
const PYTHON_CMD = process.platform === "win32" ? "python" : "python3";

// ─── Map Python "type" to DB enum values ─────────────────────────────────────

function mapType(type) {
  if (type === "content-ml")     return "content";
  if (type === "tfidf-fallback") return "fallback";
  if (type === "collaborative")  return "collaborative";
  return "popular";
}

// ─── Core: run ML for one user, upsert into cache ────────────────────────────

function runRecommenderForUser(userId) {
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
        if (start === -1 || end === -1) throw new Error("No JSON array in output");

        const recommendations = JSON.parse(raw.slice(start, end + 1));
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
          return resolve({ userId, count: 0 });
        }

        // Python returns "id" not "book_id", and "type" not "reason"
        const values = recommendations.map((r) => [
          userId,
          r.id,
          r.score   ?? 0,
          mapType(r.type),
        ]);

        await db.query(
          `INSERT INTO recommendation_cache (user_id, book_id, score, reason, computed_at)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             score       = VALUES(score),
             reason      = VALUES(reason),
             computed_at = NOW()`,
          [values]
        );

        resolve({ userId, count: recommendations.length });
      } catch (err) {
        reject(err);
      }
    });

    proc.on("error", reject);
  });
}

// ─── Batch: refresh all active users ─────────────────────────────────────────

async function refreshAllRecommendations() {
  console.log("[RecommendationCron] Starting full refresh...");

  let users;
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN borrows b ON b.user_id = u.id
       WHERE b.borrowed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
         AND u.role = 'student'
       ORDER BY u.id`
    );
    users = rows;
  } catch (err) {
    console.error("[RecommendationCron] Failed to fetch active users:", err.message);
    return;
  }

  if (users.length === 0) {
    console.log("[RecommendationCron] No active users found, skipping.");
    return;
  }

  console.log(`[RecommendationCron] Refreshing ${users.length} users...`);

  let success = 0;
  let failed  = 0;

  const BATCH_SIZE = 5;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch   = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((u) => runRecommenderForUser(u.id))
    );

    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        success++;
      } else {
        failed++;
        console.error(
          `[RecommendationCron] Failed for user ${batch[idx].id}:`,
          r.reason?.message
        );
      }
    });

    if (i + BATCH_SIZE < users.length) {
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  // Prune entries older than 48 hours
  await db.query(
    `DELETE FROM recommendation_cache
     WHERE computed_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)`
  );

  console.log(
    `[RecommendationCron] Done — ✓ ${success} succeeded, ✗ ${failed} failed.`
  );
}

// ─── Single-user refresh (call after borrow / return) ────────────────────────

export async function refreshForUser(userId) {
  try {
    const result = await runRecommenderForUser(userId);
    console.log(
      `[RecommendationCron] Refreshed ${result.count} recs for user ${userId}`
    );
  } catch (err) {
    console.error(
      `[RecommendationCron] Failed to refresh user ${userId}:`,
      err.message
    );
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export function startRecommendationCron() {
  cron.schedule("0 */6 * * *", refreshAllRecommendations, {
    timezone: "Asia/Manila",
  });

  console.log("[RecommendationCron] Scheduled — runs every 6 hours (Asia/Manila).");

  // Warm cache 30s after server boot
  setTimeout(() => {
    console.log("[RecommendationCron] Running startup warm-up...");
    refreshAllRecommendations();
  }, 30_000);
}


