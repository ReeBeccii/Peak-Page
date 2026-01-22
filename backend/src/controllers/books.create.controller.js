// src/controllers/books.create.controller.js
import { dbGet, dbRun } from "../db/db.js";

function requireUser(req, res) {
  const user = req.session?.user;
  if (!user?.id) {
    res.status(401).json({ error: "Nicht eingeloggt." });
    return null;
  }
  return user;
}

function parseAuthors(authorRaw) {
  // erlaubt: "Sebastian Fitzek" oder "A, B, C"
  return String(authorRaw || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export async function createBook(req, res) {
  const user = requireUser(req, res);
  if (!user) return;

  const {
    title,
    author,        // kommt aus dem Frontend als Text
    isbn,
    coverUrl,
    price,
    format,
    notes,
    status,
    rating,
    readYear,      // Lesejahr (Jahr-Zahl)
    // publishedYear -> wird bewusst NICHT in books gespeichert (weil deine DB-Spalte nicht existiert)
  } = req.body ?? {};

  if (!title || !author) {
    return res.status(400).json({ error: "Titel und Autor:in sind Pflichtfelder." });
  }

  const allowedStatus = new Set(["unread", "finished"]);
  if (!allowedStatus.has(status)) {
    return res.status(400).json({ error: "Ungültiger Status. Erlaubt: unread, finished." });
  }

  if (rating !== undefined && rating !== null) {
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Bewertung muss zwischen 1 und 5 liegen." });
    }
  }

  // 1) Buch finden oder anlegen (NUR mit Spalten, die es sicher gibt!)
  let bookRow = null;

  if (isbn) {
    bookRow = await dbGet(`SELECT id FROM books WHERE isbn13 = ?`, [String(isbn)]);
  }

  if (!bookRow) {
    const insertBook = await dbRun(
      `
      INSERT INTO books (isbn13, title, cover_url, default_price)
      VALUES (?, ?, ?, ?)
      `,
      [
        isbn ? String(isbn) : null,
        String(title),
        coverUrl ? String(coverUrl) : null,
        price !== undefined && price !== null ? Number(price) : null,
      ]
    );

    bookRow = { id: insertBook.lastID };
  }

  // 2) Autor(en) in authors + Mapping-Tabelle schreiben (damit Bibliothek/SuB sie wieder anzeigen können)
  const authors = parseAuthors(author);

  // --- HIER ggf. Tabellennamen anpassen: authors und book_authors ---
  for (const name of authors) {
    // author upsert-ish
    let a = await dbGet(`SELECT id FROM authors WHERE name = ? LIMIT 1`, [name]);
    if (!a) {
      const insA = await dbRun(`INSERT INTO authors (name) VALUES (?)`, [name]);
      a = { id: insA.lastID };
    }

    // mapping upsert-ish (kein Duplikat)
    const existingLink = await dbGet(
      `SELECT 1 FROM book_authors WHERE book_id = ? AND author_id = ? LIMIT 1`,
      [bookRow.id, a.id]
    );

    if (!existingLink) {
      await dbRun(
        `INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)`,
        [bookRow.id, a.id]
      );
    }
  }
  // --- ENDE Mapping ---

  // 3) format_id auflösen
  let formatId = null;
  if (format) {
    const f = await dbGet(`SELECT id FROM formats WHERE name = ? LIMIT 1`, [String(format)]);
    if (f?.id) formatId = f.id;
  }

  // 4) finished_at berechnen (Lesejahr korrekt übernehmen!)
  let finishedAt = null;

  if (status === "finished") {
    if (readYear !== undefined && readYear !== null && Number.isFinite(Number(readYear))) {
      finishedAt = `${Number(readYear)}-01-01`;
    } else {
      finishedAt = "AUTO_NOW";
    }
  } else {
    finishedAt = null;
  }

  let finishedAtSql = "?";
  let finishedAtParam = finishedAt;

  if (finishedAt === "AUTO_NOW") {
    finishedAtSql = "datetime('now')";
    finishedAtParam = null;
  }

  const finalRating = status === "finished" ? (rating ?? null) : null;

  const ub = await dbRun(
    `
    INSERT INTO user_books
      (user_id, book_id, status, rating, notes, price_paid, format_id, finished_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ${finishedAtSql})
    `,
    [
      user.id,
      bookRow.id,
      status,
      finalRating,
      notes ?? null,
      price !== undefined && price !== null ? Number(price) : null,
      formatId,
      ...(finishedAtSql === "?" ? [finishedAtParam] : []),
    ]
  );

  return res.status(201).json({
    ok: true,
    book_id: bookRow.id,
    user_book_id: ub.lastID,
    message: "Buch gespeichert ✅",
  });
}
