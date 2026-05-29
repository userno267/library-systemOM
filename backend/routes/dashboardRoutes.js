import express from "express";
import {
  getOverview,
  getBorrowTrends,
  getUserGrowth,
  getTopBooks,
  getTopBorrowers,
  generateAIInsight
} from "../controllers/dashboardController.js";
import { adminOnly } from "../middleware/admin.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.use(auth, adminOnly);

router.get("/overview", getOverview);
router.get("/borrow-trends", getBorrowTrends);
router.get("/user-growth", getUserGrowth);
router.get("/top-books", getTopBooks);
router.get("/top-borrowers", getTopBorrowers);
router.post("/ai-insight", generateAIInsight);

export default router;