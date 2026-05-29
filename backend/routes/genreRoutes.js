import express from "express";
import pool from "../db/db.js";

const router = express.Router();

// GET all genres
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM genres ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch genres" });
  }
});

export default router;
