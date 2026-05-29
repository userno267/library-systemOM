import express from "express";
import pool from "../db/db.js";

const router = express.Router();

// GET all categories
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM categories ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;
