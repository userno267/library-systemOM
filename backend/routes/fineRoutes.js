import express from "express";
import { auth } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";
import {
  getUserFines,
  getMyFines,
  getReceiptData,
  payFine,
  waiveFine,
  addManualFine,
  payMultipleFines, getGroupReceiptData 
} from "../controllers/fineController.js";

const router = express.Router();

// student: get their own fines with filters
router.get("/my", auth, getMyFines);

// receipt — both admin and student
router.get("/receipt/:fineId", auth, getReceiptData);

// admin only
router.get("/user/:userId", auth, adminOnly, getUserFines);
router.post("/user/:userId/add", auth, adminOnly, addManualFine);
router.post("/:fineId/pay", auth, adminOnly, payFine);
router.post("/:fineId/waive", auth, adminOnly, waiveFine);

router.get("/receipt/group/:groupId", auth, getGroupReceiptData);
router.post("/pay-multiple", auth, adminOnly, payMultipleFines);
export default router;