// routes/attendanceRoutes.js

import express from "express";
import {
  scanAttendance,
  getAttendance,
  getAttendanceStats
} from "../controllers/Attendancecontroller.js";
import { auth }      from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

// Student — scan wall QR (time in / time out)
router.post("/scan", auth, scanAttendance);

// Admin — view all attendance with filters
router.get("/",      auth, adminOnly, getAttendance);
router.get("/stats", auth, adminOnly, getAttendanceStats);

export default router;