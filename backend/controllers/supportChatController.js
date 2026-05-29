import db from "../db/db.js";

// =====================
// Send Message
// =====================
export const sendMessage = async (req, res) => {
  let { conversationId, message, studentId } = req.body; // studentId required if admin sends first message
  const senderRole = req.user?.role;
  const senderId = req.user?.id;

  if (!message) return res.status(400).json({ message: "Message required" });

  try {
    // ==========================
    // AUTO CREATE CONVERSATION
    // ==========================
    if (!conversationId) {
      if (senderRole === "admin") {
        if (!studentId) {
          return res.status(400).json({ message: "studentId required for admin messages" });
        }

        // Check if student already has a conversation
        const [existing] = await db.query(
          "SELECT * FROM conversations WHERE user_id = ? LIMIT 1",
          [studentId]
        );

        if (existing.length) {
          conversationId = existing[0].id;
        } else {
          // Create new conversation for student
          const [result] = await db.query(
            "INSERT INTO conversations (user_id) VALUES (?)",
            [studentId]
          );
          conversationId = result.insertId;
        }
      } else {
        // student sending first message
        const [existing] = await db.query(
          "SELECT * FROM conversations WHERE user_id = ? LIMIT 1",
          [senderId]
        );
        if (existing.length) {
          conversationId = existing[0].id;
        } else {
          const [result] = await db.query(
            "INSERT INTO conversations (user_id) VALUES (?)",
            [senderId]
          );
          conversationId = result.insertId;
        }
      }
    }

    // ==========================
    // VALIDATE CONVERSATION
    // ==========================
    const [conv] = await db.query(
      "SELECT * FROM conversations WHERE id = ?",
      [conversationId]
    );
    if (!conv.length) return res.status(404).json({ message: "Conversation not found" });

    // Access control for students
    if (senderRole === "student" && conv[0].user_id !== senderId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // ==========================
    // INSERT MESSAGE
    // ==========================
    await db.query(
      "INSERT INTO messages (conversation_id, sender, message) VALUES (?, ?, ?)",
      [conversationId, senderRole, message]
    );

    await db.query(
      "UPDATE conversations SET last_message_at = NOW() WHERE id = ?",
      [conversationId]
    );

    // ==========================
    // SOCKET EMIT
    // ==========================
    const io = req.app.get("io");
    io.to(`conversation_${conversationId}`).emit("newMessage", {
      conversationId,
      sender: senderRole,
      message,
      created_at: new Date(),
    });

    res.json({ message: "Message sent", conversationId });
  } catch (err) {
    console.error("Send Message Error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
};
// =====================
// Get messages for a conversation
// =====================
export const getConversationMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    // Validate conversation
    const [conv] = await db.query(
      "SELECT * FROM conversations WHERE id = ?",
      [conversationId]
    );
    if (!conv.length) return res.status(404).json({ message: "Conversation not found" });

    // Access control for users
    if (role === "student" && conv[0].user_id !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const [messages] = await db.query(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [conversationId]
    );

    res.json(messages);
  } catch (err) {
    console.error("Get Messages Error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

// =====================
// Admin: get all conversations
// =====================
export const getConversationsForAdmin = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const [conversations] = await db.query(`
      SELECT 
          u.id AS user_id,
          u.full_name AS user_name,
          c.id AS conversation_id,
          c.last_message_at,
          last_msg.last_message,
          COALESCE(unread_counts.unread_count, 0) AS unread_count
      FROM users u
      LEFT JOIN conversations c ON c.user_id = u.id
      LEFT JOIN (
          SELECT m.conversation_id, m.message AS last_message
          FROM messages m
          INNER JOIN (
              SELECT conversation_id, MAX(created_at) AS max_created
              FROM messages
              GROUP BY conversation_id
          ) grouped ON grouped.conversation_id = m.conversation_id AND grouped.max_created = m.created_at
      ) last_msg ON last_msg.conversation_id = c.id
      LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS unread_count
          FROM messages
          WHERE sender='student' AND is_read=FALSE
          GROUP BY conversation_id
      ) unread_counts ON unread_counts.conversation_id = c.id
      ORDER BY c.last_message_at DESC, u.full_name ASC
    `);

    res.json(conversations);
  } catch (err) {
    console.error("Get Conversations Error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};
// =====================
// Mark messages as read in a conversation
// =====================
export const markMessagesAsRead = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    // Validate conversation
    const [conv] = await db.query("SELECT * FROM conversations WHERE id = ?", [conversationId]);
    if (!conv.length) return res.status(404).json({ message: "Conversation not found" });

    // Users can only mark their own messages
    if (role === "student" && conv[0].user_id !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await db.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE conversation_id = ? AND sender != ?`,
      [conversationId, role]
    );

    res.json({ message: "Messages marked as read" });
  } catch (err) {
    console.error("Mark Messages Read Error:", err);
    res.status(500).json({ message: "Failed to mark messages as read" });
  }
};

export const getMyConversation = async (req, res) => {
  try {
    const userId = req.user.id;

    const [conv] = await db.query(
      "SELECT * FROM conversations WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (!conv.length) {
      return res.status(404).json({ message: "No conversation found" });
    }

    res.json(conv[0]);
  } catch (err) {
    console.error("Get My Conversation Error:", err);
    res.status(500).json({ message: "Failed to fetch conversation" });
  }
};

export const searchUsersForChat = async (req, res) => {
  const { query = "" } = req.query;

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const [users] = await db.query(
      `
      SELECT 
        u.id AS user_id,
        u.full_name AS user_name,
        u.lrn,
        c.id AS conversation_id,
        c.last_message_at
      FROM users u
      LEFT JOIN conversations c ON c.user_id = u.id
      WHERE u.full_name LIKE ? OR u.lrn LIKE ?
      ORDER BY u.full_name ASC
      LIMIT 20
      `,
      [`%${query}%`, `%${query}%`]
    );

    res.json(users);
  } catch (err) {
    console.error("Search Users Error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};