import express from "express";
import { auth } from "../middleware/auth.js";
import {
  addToWishlist,
  removeFromWishlist,
  checkWishlist
} from "../controllers/wishlistController.js";

const router = express.Router();

router.post("/", auth, addToWishlist);
router.delete("/:bookId", auth, removeFromWishlist);
router.get("/:bookId", auth, checkWishlist);

export default router;