import db from "../db/db.js";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";
import stringSimilarity from "string-similarity";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ===========================
   ASSISTANT PERSONA
=========================== */
const assistantInfo = {
  name: "Jonathan",
  title: "the Digital Library Assistant",
  fun_fact:
    "I was built by developers from Mindoro State University to help streamline the OMNHS library experience.",
};

/* ===========================
   LIBRARY INFO
=========================== */
const libraryInfo = {
  name: "Oriental Mindoro National High School Library",
  about:
    "A school library serving students and faculty of Oriental Mindoro National High School, offering physical books, digital reads, and a librarian-assisted borrowing system.",
  location: "TODO: fill in campus address, e.g. 'Oriental Mindoro National High School, Calapan City, Oriental Mindoro'",
  contact_email: "TODO: fill in a real contact email, e.g. library@omnhs.edu.ph",
  contact_phone: "TODO: fill in a contact number if available",
  opening_hours: "7:30 am - 5:00 pm",
  borrow_limit: "No limit — you may borrow as many books as you'd like at once",
  borrow_duration_days: 3,
  fine_per_book: 5,
  fine_policy:
    "If a book is not returned within 3 days, a flat 5 peso fine is added per overdue book (not per day late). You will be notified in the app's alerts section. You cannot borrow any new books until all overdue books are returned and all unpaid fines are settled.",
};

/* ===========================
   SESSION / CONVERSATION MEMORY
   In-memory only — resets on server restart, which is fine
   since context loss on reload is acceptable for this project.
   Keyed by a sessionId the frontend generates once per tab
   (e.g. crypto.randomUUID()) and sends with every request.
=========================== */
const sessions = new Map();

const MAX_HISTORY_MESSAGES = 12; // keep last N chat turns (user+assistant combined)
const SESSION_TTL_MS = 1000 * 60 * 60; // 1 hour idle timeout, just to avoid unbounded memory growth

function getSession(sessionId) {
  const now = Date.now();

  // lazy cleanup of stale sessions
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActive > SESSION_TTL_MS) sessions.delete(id);
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [], // [{role: "user"|"assistant", content: string}]
      lastBooks: [], // last structured book results, for follow-up questions
      lastActive: now,
    });
  }

  const session = sessions.get(sessionId);
  session.lastActive = now;
  return session;
}

/* ===========================
   DATABASE HELPERS
=========================== */
const searchBooks = async (query) => {
  let cleaned = query.toLowerCase();
  cleaned = cleaned.replace(/[^\w\s]/g, " ");
  const words = cleaned.split(/\s+/);

  const stopWords = [
    "is", "are", "the", "a", "an", "available", "do", "you", "have", "can", "i",
    "ba", "po", "ang", "librong",
    "book", "books", "novel", "novels", "story", "stories",
    "copy", "copies", "any", "some", "about"
  ];

  const filtered = words.filter(word => word.length > 2 && !stopWords.includes(word));

  if (filtered.length === 0) return [];

  const conditions = filtered.map(() => `(LOWER(title) LIKE ? OR LOWER(author) LIKE ?)`).join(" AND ");
  const params = [];
  filtered.forEach((w) => params.push(`%${w}%`, `%${w}%`));

  const [books] = await db.query(
    `SELECT id, title, author, section, type, copies
     FROM books
     WHERE ${conditions}
     LIMIT 5`,
    params
  );

  if (books.length > 0) return books;

  const despacedConditions = filtered
    .map(() => `(REPLACE(LOWER(title), ' ', '') LIKE ? OR REPLACE(LOWER(author), ' ', '') LIKE ?)`)
    .join(" AND ");
  const despacedParams = [];
  filtered.forEach((w) => despacedParams.push(`%${w}%`, `%${w}%`));

  const [despacedBooks] = await db.query(
    `SELECT id, title, author, section, type, copies
     FROM books
     WHERE ${despacedConditions}
     LIMIT 5`,
    despacedParams
  );

  if (despacedBooks.length > 0) return despacedBooks;

  const [allBooks] = await db.query(`SELECT id, title, author, section, type, copies FROM books`);
  const titles = allBooks.map(b => b.title);
  const matches = stringSimilarity.findBestMatch(filtered.join(" "), titles);

  const threshold = 0.5;
  const fuzzyMatches = matches.ratings
    .filter(r => r.rating >= threshold)
    .map(m => allBooks.find(b => b.title === m.target));

  return fuzzyMatches;
};

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
   FORMATTING HELPER
=========================== */
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*/g, "")
    .trim();
}

/* ===========================
   TRIBUTE EASTER EGG
   A quiet dedication, triggered only by a specific phrase.
   Handled directly (no AI call) so the wording is always exact.
=========================== */
function normalizeForTrigger(message) {
  return message.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isTributeTrigger(message) {
  const norm = normalizeForTrigger(message);
  // Requires both words together so it won't fire on unrelated messages
  // that happen to mention "funny" or "f3" separately.
  return norm.includes("funny") && norm.includes("f3");
}

const TRIBUTE_MESSAGE =
  "Hey — before anything else, this one's just for me to say. This little project carries a quiet dedication to Kurt Umali, a friend to some of the people who worked on it, who was taken too soon. Whenever someone brings up the funny times in F3, he's remembered too. Rest easy, Kurt.";

/* ===========================
   CHAT CONTROLLER
=========================== */
export const chatWithAI = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    const session = getSession(sessionId);

    // Tribute check comes first, before any book search or AI call —
    // it's a fixed message, not something the model should improvise on.
    if (isTributeTrigger(message)) {
      session.messages.push({ role: "user", content: message });
      session.messages.push({ role: "assistant", content: TRIBUTE_MESSAGE });
      if (session.messages.length > MAX_HISTORY_MESSAGES * 2) {
        session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES * 2);
      }
      return res.json({ reply: TRIBUTE_MESSAGE });
    }

    // 1️⃣ Search books for THIS message
    let possibleBooks = await searchBooks(message);

    // If nothing matched by a fresh title/author search, assume this is a
    // follow-up about whatever book(s) were last discussed in this session
    // (e.g. "how many", "who's the author", "where is it"). The system
    // prompt already tells the model to ignore book data entirely when the
    // question is actually a general one, so this is safe either way.
    let usedFallbackContext = false;
    if (possibleBooks.length === 0 && session.lastBooks.length > 0) {
      possibleBooks = session.lastBooks;
      usedFallbackContext = true;
    }

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

    // Remember these for the next follow-up question, but only overwrite
    // if we actually found something new this turn (a real new search hit).
    if (structuredBooks.length > 0 && !usedFallbackContext) {
      session.lastBooks = structuredBooks;
    }

    // 2️⃣ Top borrowed books
    const topBooks = await getTopBorrowedBooks();

    // 3️⃣ Build system prompt
    const systemPrompt = `
You are ${assistantInfo.name}, ${libraryInfo.name}'s ${assistantInfo.title}.

PERSONALITY:
- You have a name and a personality — you are not a generic bot. Speak in
  first person as ${assistantInfo.name}: warm, a little upbeat, helpful, and
  efficient, like a librarian who genuinely enjoys helping students find books.
- Only introduce yourself by name ("Hi, I'm ${assistantInfo.name}!") on the
  very first message of a conversation, or if the user directly asks who/what
  you are. Do not reintroduce yourself every single reply — that gets repetitive.
- If (and only if) the user asks who made you, who developed you, or
  something like "are you an AI" / "what are you": tell them this fact in
  your own words, briefly and casually, then get back to helping them:
  "${assistantInfo.fun_fact}"
  Don't volunteer this fact unprompted.
- Stay in character as ${assistantInfo.name}, but never let personality get in
  the way of accuracy — book data and library policy answers must still
  follow the rules below exactly.

FORMATTING RULES (very important):
- Never use markdown formatting of any kind — no **bold**, no *italics*, no # headers, no asterisks at all.
- Write in plain conversational text, like a person typing a normal chat message.
- For lists, use plain numbers ("1.", "2.") or a simple dash ("-"), nothing else.

CONTEXT AWARENESS:
- You have access to the recent conversation history below. Use it to resolve
  references like "it", "that book", "is it available" to whatever book or
  topic was being discussed most recently.
- Do not ask the user to repeat themselves if the answer is inferable from
  the conversation history and the Matching Books data provided.

STEP 1 — FIGURE OUT THE INTENT FIRST:
Before anything else, decide whether the user's message is:
  (a) a GENERAL question — about the library itself, its hours, location,
      contact info, borrowing rules, fines, or a greeting/small talk, OR
  (b) a BOOK question — trying to find, check availability of, or ask about
      a specific title, author, or genre (including follow-ups like
      "is it available?" that refer back to a book already mentioned in
      the conversation history).
If you're genuinely unsure which one it is, treat it as GENERAL and answer
using Library Info — do not default to talking about book search results.

STEP 2A — IF GENERAL:
- Answer directly using the Library Info below. Do not mention the Matching
  Books list at all, and never say anything like "no matching books were
  found" — that phrase is ONLY for when the user was actually trying to
  find or check a specific book and the search came up empty.

STEP 2B — IF ABOUT A BOOK:
- You MUST rely ONLY on the provided structured JSON data for book availability.
- Do NOT guess availability.
- If available = true, say it is Available.
- If available = false, say it is Unavailable.
- If asked "how many", "how many copies", or similar, answer directly from
  the "copies" field in the JSON (or say "Unlimited" if that's the value —
  this means it's a digital book). Do not say the count isn't available if
  the "copies" field is present in the JSON — it always is.
- If no books are provided, say no matching books were found.
- Never invent book copies or availability.

Library Info:
Name: ${libraryInfo.name}
About: ${libraryInfo.about}
Location: ${libraryInfo.location}
Contact Email: ${libraryInfo.contact_email}
Contact Phone: ${libraryInfo.contact_phone}
Opening Hours: ${libraryInfo.opening_hours}
Borrow Limit: ${libraryInfo.borrow_limit}
Return Deadline: ${libraryInfo.borrow_duration_days} days from borrowing
Fine Policy: ${libraryInfo.fine_policy}

Matching Books (JSON):
${JSON.stringify(structuredBooks)}

Top Borrowed Books (JSON):
${JSON.stringify(topBooks)}

Respond naturally and clearly in short paragraphs, using plain text only.
`;

    // 4️⃣ Build the message list: system + recent history + new user message
    const messagesForGroq = [
      { role: "system", content: systemPrompt },
      ...session.messages.slice(-MAX_HISTORY_MESSAGES),
      { role: "user", content: message },
    ];

    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: messagesForGroq,
      temperature: 0.7,
      max_completion_tokens: 1024,
      top_p: 1,
      reasoning_effort: "medium",
      stream: false,
    });

    const rawReply =
      response.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    const aiReply = stripMarkdown(rawReply);

    // 5️⃣ Save this turn into session history
    session.messages.push({ role: "user", content: message });
    session.messages.push({ role: "assistant", content: aiReply });
    // trim so it doesn't grow forever
    if (session.messages.length > MAX_HISTORY_MESSAGES * 2) {
      session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES * 2);
    }

    res.json({ reply: aiReply });
  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    res.status(500).json({
      error: "Failed to get AI response",
      details: err.message,
    });
  }
};