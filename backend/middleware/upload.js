import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "book_file") {
      cb(null, "public/uploads/books");
    } 
    else if (file.fieldname === "cover_image") {
      cb(null, "public/uploads/covers");
    } 
    else if (file.fieldname === "profile_image") {
      cb(null, "public/uploads/profile");   // ✅ NEW
    }
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});