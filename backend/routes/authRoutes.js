import express from "express";
import { register, login, verifyEmail, resendCode } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-code", resendCode);

export default router;