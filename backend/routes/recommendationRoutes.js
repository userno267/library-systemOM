import express from "express";
import { auth } from "../middleware/auth.js";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get("/recommendations", auth, (req, res) => {
  console.log("🌟 Recommendations route hit");
  console.log("REQ USER:", req.user);

  const userId = req.user.id;

  const pyExecutable = path.join(__dirname, "../../ml_recommender/venv/Scripts/python.exe");
  const scriptPath = path.join(__dirname, "../../ml_recommender/recommender.py");

  console.log("🌟 Using Python:", pyExecutable);
  console.log("🌟 Script path:", scriptPath);
  console.log("🌟 User ID:", userId);

  execFile(pyExecutable, [scriptPath, userId], (error, stdout, stderr) => {
    if (error) {
      console.error("❌ EXEC ERROR:", error);
      console.error("❌ STDERR:", stderr);
      return res.status(500).json({
        message: "ML execution failed",
        error: stderr || error.message
      });
    }

    console.log("✅ Python stdout:", stdout);

    try {
      const data = JSON.parse(stdout);
      res.json(data);
    } catch (parseErr) {
      console.error("❌ PARSE ERROR:", parseErr);
      console.error("RAW OUTPUT:", stdout);
      res.status(500).json({
        message: "Invalid ML output",
        raw: stdout
      });
    }
  });
});

export default router;
