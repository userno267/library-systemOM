import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secretkey"
      
    );

    req.user = decoded; // 👈 THIS is what borrowController needs
    next();
  } catch (err) {
    console.error("JWT ERROR:", err);
    return res.status(403).json({ message: "Invalid token" });
  }
};
