import express from "express";
import { chatWithAI } from "../controllers/chatController.js";

const router = express.Router();

// POST /api/chat
// Body: { message: "user's question" }
router.post("/chat", chatWithAI);

export default router;