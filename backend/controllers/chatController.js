import db from "../db/db.js";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";
import stringSimilarity from "string-similarity";

dotenv.config();

// Initialize Groq with env key
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ===========================
   LIBRARY INFO
=========================== */
const libraryInfo = {
  opening_hours: "7:30 am - 5:00 pm",
  borrow_limit: 5,
  borrow_duration_days: 7,
  fine_per_day: 20,
};

/* ===========================
   DATABASE HELPERS
=========================== */

// Search books with stop words removal and fuzzy matching
const searchBooks = async (query) => {
  console.log("📥 Original Query:", query);

  // Normalize
  let cleaned = query.toLowerCase();
  cleaned = cleaned.replace(/[^\w\s]/g, " "); // remove punctuation
  const words = cleaned.split(/\s+/);

  // English + Tagalog filler words
  const stopWords = [
    "is", "are", "the", "a", "an", "available", "do", "you", "have", "can", "i",
    "ba", "po", "ang", "librong"
  ];

  const filtered = words.filter(word => word.length > 2 && !stopWords.includes(word));
  console.log("🧠 Filtered Words (user query):", filtered);

  if (filtered.length === 0) return [];

  const pattern = `%${filtered.join("%")}%`;
  console.log("🔎 LIKE Search Pattern:", pattern);

  // Basic LIKE search
  const [books] = await db.query(
    `SELECT id, title, author, section, type, copies
     FROM books
     WHERE LOWER(title) LIKE ?
        OR LOWER(author) LIKE ?
     LIMIT 5`,
    [pattern, pattern]
  );

  if (books.length > 0) return books;

  // Fuzzy matching fallback
  const [allBooks] = await db.query(`SELECT id, title, author, section, type, copies FROM books`);
  const titles = allBooks.map(b => b.title);
  const matches = stringSimilarity.findBestMatch(filtered.join(" "), titles);

  const threshold = 0.5; // adjust if needed
  const fuzzyMatches = matches.ratings
    .filter(r => r.rating >= threshold)
    .map(m => allBooks.find(b => b.title === m.target));

  console.log("🔍 Fuzzy Matches:", fuzzyMatches);

  return fuzzyMatches;
};

// Check availability
const checkBookAvailability = async (bookId) => {
  const [[book]] = await db.query(
    `SELECT id, title, author, section, type, copies
     FROM books
     WHERE id = ?`,
    [bookId]
  );

  if (!book) return null;
  const available = book.type === "digital" || book.copies > 0;
  return { ...book, available };
};

// Get top borrowed books
const getTopBorrowedBooks = async () => {
  const [books] = await db.query(
    `SELECT b.id, b.title, b.author, b.section, COUNT(*) AS borrow_count
     FROM borrows br
     JOIN books b ON br.book_id = b.id
     GROUP BY b.id
     ORDER BY borrow_count DESC
     LIMIT 5`
  );

  return books.map((b, i) => ({ ...b, rank: i + 1 }));
};

/* ===========================
   CHAT CONTROLLER
=========================== */
export const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });

    console.log("📝 User Message:", message);

    // 1️⃣ Search books
    const possibleBooks = await searchBooks(message);
    console.log("🔎 Raw DB Search Result:", possibleBooks);

    const structuredBooks = await Promise.all(
      possibleBooks.map(async (b) => {
        const data = await checkBookAvailability(b.id);
        return {
          id: b.id,
          title: b.title,
          author: b.author,
          section: b.section,
          type: b.type,
          copies: b.type === "physical" ? b.copies : "Unlimited",
          available: data?.available || false
        };
      })
    );
    console.log("📦 Structured Book Data (Sent To AI):", structuredBooks);

    // 2️⃣ Top borrowed books
    const topBooks = await getTopBorrowedBooks();
    console.log("🏆 Top Borrowed Books:", topBooks);

    // 3️⃣ Build system prompt for AI
    const systemPrompt = `
You are a professional AI librarian assistant.

IMPORTANT RULES:
- You MUST rely ONLY on the provided structured JSON data.
- Do NOT guess availability.
- If available = true, say it is Available.
- If available = false, say it is Unavailable.
- If no books are provided, say no matching books were found.
- Never invent book copies or availability.

Library Info:
Opening Hours: ${libraryInfo.opening_hours}
Borrow Limit: ${libraryInfo.borrow_limit}
Borrow Duration: ${libraryInfo.borrow_duration_days} days
Fine per day: ${libraryInfo.fine_per_day} pesos

Matching Books (JSON):
${JSON.stringify(structuredBooks)}

Top Borrowed Books (JSON):
${JSON.stringify(topBooks)}

Respond naturally and clearly in short paragraphs.
`;

    // 4️⃣ Send to Groq
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_completion_tokens: 1024,
      top_p: 1,
      reasoning_effort: "medium",
      stream: false,
    });

    const aiReply =
      response.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    console.log("🤖 AI Reply:", aiReply);

    res.json({ reply: aiReply });
  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    res.status(500).json({
      error: "Failed to get AI response",
      details: err.message,
    });
  }
};