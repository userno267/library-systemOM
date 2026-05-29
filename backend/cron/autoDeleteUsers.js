import cron from "node-cron";
import { deleteUsersAndRelations } from "../cron/userCleanupService.js";
import pool from "../db/db.js";


cron.schedule("0 2 * * *", async () => {
  try {
    console.log("🧹 Running auto-delete users job...");

    const [users] = await pool.query(
      `SELECT id FROM users
       WHERE role = 'student'
       AND created_at <= NOW() - INTERVAL 3 YEAR`
    );

    const userIds = users.map(u => u.id);

    const result = await deleteUsersAndRelations(userIds);
    
    console.log(`✅ Deleted ${result.deleted} users + relations`);
  } catch (err) {
    console.error("❌ Auto-delete failed:", err.message);
  }
});