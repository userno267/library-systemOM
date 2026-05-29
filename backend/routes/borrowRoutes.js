import express from "express";
import { borrowBook, returnBook, getBorrowHistory ,getBorrowHistoryByUser  ,adminBorrowBook,
  getActiveBorrows,adminReturnBook, approveBorrow, approveReturn, rejectRequest} from "../controllers/borrowController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/borrow", auth, borrowBook);
router.post("/return", auth, returnBook);
router.get("/borrows/history", auth, getBorrowHistory);
// Admin can view borrow history of any user
router.get("/borrows/history/:userId", getBorrowHistoryByUser);
router.post("/admin/borrow", adminBorrowBook);
router.get("/admin/active", getActiveBorrows);
router.post("/admin/return", adminReturnBook);
router.post("/admin/approve-borrow", approveBorrow);
router.post("/admin/approve-return", approveReturn);
router.post("/admin/reject", rejectRequest);
export default router;
