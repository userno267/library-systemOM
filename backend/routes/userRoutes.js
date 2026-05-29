import express from "express";
import { auth } from "../middleware/auth.js";
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateProfile,
  getProfile,
  bulkDeleteUsers,
} from "../controllers/userController.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

/* ===========================
   USER PROFILE (NORMAL USER)
=========================== */
// Logged-in users can access their own profile
router.get("/profile", auth, getProfile);
router.put("/profile", auth, upload.single("profile_image"), updateProfile);

/* ===========================
   ADMIN ONLY ROUTES
=========================== */

router.get("/", listUsers);
router.post("/", createUser);

// Explicit admin route for fetching any user by ID
router.get("/admin/:id", getUserById);
router.put("/:id", updateUser);

router.delete("/bulk-delete", bulkDeleteUsers);
router.delete("/:id", deleteUser);

export default router;