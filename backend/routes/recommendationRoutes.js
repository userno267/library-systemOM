// backend/routes/recommendationRoutes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import { getRecommendations } from "../controllers/recommendationController.js";

const router = express.Router();

router.get("/recommendations", auth, getRecommendations);

export default router;