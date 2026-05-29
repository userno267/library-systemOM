import pool from "../db/db.js";

export const deleteUsersAndRelations = async (userIds) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    if (!userIds || userIds.length === 0) {
      await conn.commit();
      return { deleted: 0 };
    }

    /* =========================
       1. GET CONVERSATIONS
    ========================= */
    const [conversations] = await conn.query(
      `SELECT id FROM conversations WHERE user_id IN (?)`,
      [userIds]
    );

    const conversationIds = conversations.map(c => c.id);

    /* =========================
       2. DELETE MESSAGES FIRST
    ========================= */
    if (conversationIds.length > 0) {
      await conn.query(
        `DELETE FROM messages WHERE conversation_id IN (?)`,
        [conversationIds]
      );
    }

    /* =========================
       3. DELETE CONVERSATIONS
    ========================= */
    await conn.query(
      `DELETE FROM conversations WHERE user_id IN (?)`,
      [userIds]
    );

    /* =========================
       4. DELETE OTHER RELATIONS
    ========================= */
    await conn.query(
      `DELETE FROM borrows WHERE user_id IN (?)`,
      [userIds]
    );

    await conn.query(
      `DELETE FROM wishlist WHERE user_id IN (?)`,
      [userIds]
    );

    /* =========================
       5. DELETE USERS
    ========================= */
    const [result] = await conn.query(
      `DELETE FROM users WHERE id IN (?)`,
      [userIds]
    );

    await conn.commit();

    return {
      deleted: result.affectedRows,
      conversations: conversations.length,
      messages: conversationIds.length
    };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};