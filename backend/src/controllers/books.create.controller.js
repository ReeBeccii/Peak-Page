// src/controllers/books.create.controller.js
import { dbGet, dbRun } from "../db/db.js";

// ==================================================
// AUTH / SESSION
// Zuständig für die Prüfung, ob ein Benutzer eingeloggt ist
// ==================================================

/**
 * Prüft, ob ein Benutzer in der Session vorhanden ist.
 * Gibt den User zurück, wenn eingeloggt – ansonsten 401 und null.
 */
function requireUser(req, res) {
  const user = req.session?.user;
  if (!user?.id) {
    res.status(401).json({ error: "Nicht eingeloggt." });
    return null;
  }
  return user;
}

// ==================================================
// INPUT-HILFSFUNKTIONEN
// Zuständig für das Aufbereiten von Eingaben (z. B. Autor:innen-Liste)
// ==================================================

/**
 * Wandelt die Autor:innen-Eingabe in ein sauberes Array um.
 * Erlaubt z. B. "Sebastian Fitzek" oder "A, B, C".
 */
function parseAuthors(authorRaw) {
  return String(authorRaw || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

// ==================================================
// BUCH ANLEGEN (CREATE)
// Zuständig für das Speichern eines Buches inkl. Autor:innen-Mapping und user_books-Eintrag
// ==================================================

/**
 * POST /api/books
 * Legt ein Buch an (oder verwendet ein vorhandenes) und erstellt die Zuordnung
 * zum eingeloggten Benutzer (user_books). Zusätzlich werden Autor:innen gespeichert
 * und mit dem Buch verknüpft (authors + book_authors).
 */
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

  // --------------------------------------------------
  // Validierung
  // --------------------------------------------------

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

  // --------------------------------------------------
  // 1) Buch finden oder anlegen
  // --------------------------------------------------
  // Hinweis: Es werden nur Spalten verwendet, die sicher in der DB existieren.

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

  // --------------------------------------------------
  // 2) Autor:innen speichern + Mapping erstellen
  // --------------------------------------------------
  // Ziel: Autor:innen in authors pflegen und via book_authors mit dem Buch verknüpfen,
  // damit Bibliothek/SuB sie später anzeigen können.

  const authors = parseAuthors(author);

  for (const name of authors) {
    let a = await dbGet(`SELECT id FROM authors WHERE name = ? LIMIT 1`, [name]);
    if (!a) {
      const insA = await dbRun(`INSERT INTO authors (name) VALUES (?)`, [name]);
      a = { id: insA.lastID };
    }

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

  // --------------------------------------------------
  // 2.5) Prüfen, ob Buch bereits in der Bibliothek existiert
  // --------------------------------------------------
  // Verhindert doppelte Einträge in user_books (UNIQUE user_id + book_id).
  // Statt eines technischen DB-Fehlers wird eine klare Meldung zurückgegeben.

  const existingUserBook = await dbGet(
    `SELECT id FROM user_books WHERE user_id = ? AND book_id = ? LIMIT 1`,
    [user.id, bookRow.id]
  );

  if (existingUserBook) {
    return res.status(409).json({
      ok: false,
      error: "Dieses Buch ist bereits in deiner Bibliothek.",
    });
  }

  // --------------------------------------------------
// 3) format_id auflösen (mit Fallback)
// --------------------------------------------------
// format_id ist in user_books NOT NULL.
// Wenn format nicht geliefert wird oder unbekannt ist, verwenden wir ein Fallback-Format.

let formatId = null;

if (format) {
  const f = await dbGet(`SELECT id FROM formats WHERE name = ? LIMIT 1`, [String(format)]);
  if (f?.id) formatId = f.id;
}

// Fallback: erstes verfügbares Format verwenden, falls kein gültiges Format gefunden wurde
if (!formatId) {
  const fallback = await dbGet(`SELECT id FROM formats ORDER BY id ASC LIMIT 1`);
  if (fallback?.id) formatId = fallback.id;
  else {
    return res.status(500).json({ error: "Konfiguration fehlt: formats Tabelle ist leer." });
  }
}

  // --------------------------------------------------
  // 4) finished_at bestimmen
  // --------------------------------------------------

  let finishedAt = null;

  if (status === "finished") {
    if (readYear !== undefined && readYear !== null && Number.isFinite(Number(readYear))) {
      finishedAt = `${Number(readYear)}-01-01`;
    } else {
      finishedAt = "AUTO_NOW";
    }
  }

  let finishedAtSql = "?";
  let finishedAtParam = finishedAt;

  if (finishedAt === "AUTO_NOW") {
    finishedAtSql = "datetime('now')";
    finishedAtParam = null;
  }

  const finalRating = status === "finished" ? (rating ?? null) : null;

  // --------------------------------------------------
  // 5) Eintrag in user_books anlegen
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Antwort
  // --------------------------------------------------

  return res.status(201).json({
    ok: true,
    book_id: bookRow.id,
    user_book_id: ub.lastID,
    message: "Buch gespeichert ✅",
  });
}