import express from "express";
import { auth } from "../middleware/auth.js";
import {
   sendMessage,
  getConversationMessages,
  getConversationsForAdmin,
  getMyConversation ,
  searchUsersForChat,
  markMessagesAsRead
} from "../controllers/supportChatController.js";

const router = express.Router();

router.post("/send", auth, sendMessage);

router.get("/my-conversation", auth, getMyConversation); // 👈 BEFORE param route

router.get("/:conversationId/messages", auth, getConversationMessages);

router.get("/admin/conversations", auth, getConversationsForAdmin);

router.get("/admin/search", auth, searchUsersForChat);
router.put("/:conversationId/read", auth, markMessagesAsRead);
export default router;