import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import pool from "./db/db.js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";
import chatRoutes from "./routes/chatRoutes.js";
import userRoutes from "./routes/userRoutes.js";
// Routes
import authRoutes from "./routes/authRoutes.js";
import bookRoutes from "./routes/bookRoutes.js";
import genreRoutes from "./routes/genreRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import borrowRoutes from "./routes/borrowRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { startNotificationCron } from "./cron/notificationCron.js";
import supportChatRoutes from "./routes/supportChatRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import "./cron/autoDeleteUsers.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ===========================
   Middleware
=========================== */

/* ================= Allowed Origins ================= */
const allowedOrigins = [
    "http://localhost:5173",
  "http://localhost:5174",
  "https://fugitively-untruthful-madalynn.ngrok-free.dev",
  "https://unprogressively-noncognitive-karis.ngrok-free.dev",
  "https://seclusion-stitch-shy.ngrok-free.dev",
];

/* ================= CORS FIX (IMPORTANT) ================= */
app.use(
  cors({
    origin: function (origin, callback) {
      // allow mobile apps / postman / server-to-server
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);

/* ✅ FIX: preflight handling (NO "*") */
app.options(/.*/, cors());

/* ================= Body Parser ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===========================
   Static files
=========================== */
app.use(
  "/uploads/covers",
  express.static(path.join(__dirname, "public/uploads/covers"))
);
import fs from "fs";
app.use(
  "/uploads/profile",
  express.static(path.join(__dirname, "public/uploads/profile"))
);
app.get("/api/proxy-image", (req, res) => {
  try {
    const imagePath = req.query.path;
    if (!imagePath) return res.status(400).send("Missing path");

    const fullPath = path.join(__dirname, "public", imagePath);
    
    if (!fs.existsSync(fullPath)) return res.status(404).send("File not found");

    // Set content type based on extension
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".gif") contentType = "image/gif";

    res.set("Content-Type", contentType);

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to read image");
  }
});

/* ===========================
   API Routes
=========================== */
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/genres", genreRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api", borrowRoutes);
app.use("/api", recommendationRoutes);
app.use("/api", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/support", supportChatRoutes);
app.use("/api/wishlist", wishlistRoutes);

/* ===========================
   Test DB Connection
=========================== */
app.get("/api/test", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ message: "DB connected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===========================
   Socket.IO Setup
=========================== */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
        "http://localhost:5173",
  "http://localhost:5174",
      "https://fugitively-untruthful-madalynn.ngrok-free.dev",//your frontend 1 ngrok
      "https://seclusion-stitch-shy.ngrok-free.dev", // your frontend 2 ngrok
      "https://unprogressively-noncognitive-karis.ngrok-free.dev", // backend LocalTunnel
    ],
    methods: ["GET", "POST"],
  },
});


// Make io accessible in routes/controllers
app.set("io", io);
startNotificationCron(io);
/* ===========================
   Socket Events
=========================== */
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("join", (userId) => {
    try {
      socket.join(`user_${userId}`);
      console.log(`✅ Socket ${socket.id} joined room user_${userId}`);
    } catch (err) {
      console.error(`❌ Join error for socket ${socket.id}:`, err);
    }
  });
socket.on("joinConversation", (conversationId) => { socket.join(`conversation_${conversationId}`); });
  socket.on("disconnect", (reason) => {
    console.log(`🔴 Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on("error", (err) => {
    console.error(`⚠️ Socket error on ${socket.id}:`, err);
  });
});

/* ===========================
   Start Server
=========================== */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server + Socket.IO running on port ${PORT}`);
});
app.get('/test-notification/:userId', (req, res) => {
  const { userId } = req.params;

  io.to(`user_${userId}`).emit("newNotification", {
    message: `Test notification for user ${userId}!`
  });

  res.json({ status: "sent" });
});