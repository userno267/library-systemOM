import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  sendAdminNotification,
  getUserNotifications
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", auth, getNotifications);
router.get("/unread-count", auth, getUnreadCount);
router.patch("/:id/read", auth, markAsRead);
router.patch("/read-all", auth, markAllAsRead);
router.get("/user/:userId", getUserNotifications);
router.post("/admin/send", auth, sendAdminNotification);
export default router;