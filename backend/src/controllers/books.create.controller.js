// src/controllers/books.create.controller.js

import { dbGet, dbRun } from "../db/db.js";

/**
 * POST /api/books
 * Erwartet (JSON):
 * {
 *   title, author,
 *   isbn?, year?, price?, format, notes?,
 *   status: "unread" | "finished",
 *   rating?: 1..5,
 *   coverUrl?: string
 * }
 */
export async function createBook(req, res) {
  try {
    // 1) Login check
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Nicht eingeloggt." });
    }

    // 2) Input
    const {
      title,
      author,
      isbn,
      price,
      format,
      notes,
      status,
      rating,
      coverUrl,
    } = req.body ?? {};

    if (!title?.trim() || !author?.trim()) {
      return res.status(400).json({ error: "Titel und Autor:in sind Pflichtfelder." });
    }

    // status Pflichtfeld
    const allowedStatus = new Set(["unread", "finished"]);
    if (!status || !allowedStatus.has(status)) {
      return res.status(400).json({ error: "Ungültiger Status. Erlaubt: unread, finished." });
    }

    // rating optional (1..5)
    let ratingValue = null;
    if (rating !== undefined && rating !== null && String(rating).trim() !== "") {
      const n = Number(rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({ error: "Rating muss eine Zahl von 1 bis 5 sein." });
      }
      ratingValue = n;
    }

    // 3) Format -> format_id (an deine formats Tabelle anpassen)
    async function getFormatId(formatValue) {
      // häufigste Variante: name enthält "paperback", "hardcover", ...
      const row = await dbGet("SELECT id FROM formats WHERE name = ? LIMIT 1", [formatValue]);
      if (row?.id) return row.id;

      // fallback: irgendein erster Eintrag
      const fallback = await dbGet("SELECT id FROM formats ORDER BY id ASC LIMIT 1");
      if (fallback?.id) return fallback.id;

      throw new Error("formats Tabelle ist leer – kein format_id möglich.");
    }

    const formatId = await getFormatId(format);

    // 4) Book upsert in books (WICHTIG: bei dir heißt es isbn13!)
    // books columns: id, isbn13, title, cover_url, default_price, created_at
    const cleanIsbn = isbn?.trim() || null;

    let book = null;
    if (cleanIsbn) {
      book = await dbGet("SELECT id FROM books WHERE isbn13 = ? LIMIT 1", [cleanIsbn]);
    }

    // Fallback: Titel
    if (!book) {
      book = await dbGet("SELECT id FROM books WHERE title = ? LIMIT 1", [title.trim()]);
    }

    let bookId = book?.id;

    if (!bookId) {
      const insert = await dbRun(
        "INSERT INTO books (isbn13, title, cover_url, default_price) VALUES (?, ?, ?, ?)",
        [
          cleanIsbn,
          title.trim(),
          coverUrl ? String(coverUrl).replace(/^http:\/\//, "https://") : null,
          price ?? null,
        ]
      );
      bookId = insert.lastID;
    } else {
      // optional: wenn es schon existiert, aber cover_url leer ist -> nachpflegen
      if (coverUrl) {
        await dbRun(
          "UPDATE books SET cover_url = COALESCE(cover_url, ?) WHERE id = ?",
          [String(coverUrl).replace(/^http:\/\//, "https://"), bookId]
        );
      }
    }

    // 5) Author upsert + book_authors
    const authorName = author.trim();

    let authorRow = await dbGet("SELECT id FROM authors WHERE name = ? LIMIT 1", [authorName]);
    if (!authorRow) {
      const insAuthor = await dbRun("INSERT INTO authors (name) VALUES (?)", [authorName]);
      authorRow = { id: insAuthor.lastID };
    }

    const linkExists = await dbGet(
      "SELECT 1 FROM book_authors WHERE book_id = ? AND author_id = ? LIMIT 1",
      [bookId, authorRow.id]
    );
    if (!linkExists) {
      await dbRun("INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)", [bookId, authorRow.id]);
    }

    // 6) user_books anlegen (status + rating + notes + price_paid)
    // finished_at setzen wenn finished
    const finishedAtSql = status === "finished" ? "datetime('now')" : "NULL";

    const sql = `
      INSERT INTO user_books
        (user_id, book_id, format_id, status, rating, notes, price_paid, finished_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ${finishedAtSql})
    `;

    const insUserBook = await dbRun(sql, [
      userId,
      bookId,
      formatId,
      status,
      ratingValue,
      notes?.trim() || null,
      price ?? null,
    ]);

    return res.status(201).json({
      ok: true,
      userBookId: insUserBook.lastID,
      bookId,
    });
  } catch (err) {
    console.error("❌ createBook Fehler:", err);
    return res.status(500).json({ error: "Serverfehler beim Speichern." });
  }
}
