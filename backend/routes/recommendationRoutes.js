// backend/routes/recommendationRoutes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import { getRecommendations, getSimilarBooks } from "../controllers/recommendationController.js";

const router = express.Router();

router.get("/recommendations", auth, getRecommendations);
router.get("/recommendations/:id/similar", auth, getSimilarBooks);

export default router;