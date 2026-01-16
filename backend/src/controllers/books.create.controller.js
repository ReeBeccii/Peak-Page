// src/controllers/books.create.controller.js
import { dbAll, dbGet, dbRun } from "../db/db.js";

/**
 * Format-Mapping: Frontend-Select -> format_id (DB)
 * Passe die IDs an deine formats-Tabelle an, falls sie anders sind.
 */
const FORMAT_MAP = {
  paperback: 1,
  hardcover: 2,
  ebook: 3,
  audio: 4,
};

async function tableExists(tableName) {
  const row = await dbGet(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  return !!row;
}

async function getColumns(tableName) {
  const rows = await dbAll(`PRAGMA table_info(${tableName})`);
  return rows.map((r) => r.name);
}

function firstExistingColumn(cols, candidates) {
  return candidates.find((c) => cols.includes(c)) ?? null;
}

function normalizeList(input) {
  // erwartet Array oder String oder null -> gibt Array von sauberen Strings zurück
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function splitGenreParts(list) {
  // Google Books hat oft sowas wie "Fiction / Thrillers / ..." -> wir splitten auf "/"
  const parts = list
    .flatMap((x) => String(x).split("/"))
    .map((x) => x.trim())
    .filter(Boolean);

  // Duplikate entfernen
  return [...new Set(parts)];
}

async function insertLookupId({ table, value, idColCandidates, valueColCandidates }) {
  if (!value) return null;

  const cols = await getColumns(table);
  const idCol = firstExistingColumn(cols, idColCandidates);
  const valueCol = firstExistingColumn(cols, valueColCandidates);

  if (!idCol || !valueCol) return null;

  await dbRun(`INSERT OR IGNORE INTO ${table} (${valueCol}) VALUES (?)`, [value]);

  const row = await dbGet(
    `SELECT ${idCol} AS id FROM ${table} WHERE ${valueCol} = ?`,
    [value]
  );

  return row?.id ?? null;
}

async function linkJoin({ joinTable, bookId, foreignId, bookIdCandidates, foreignIdCandidates }) {
  if (!bookId || !foreignId) return;

  const cols = await getColumns(joinTable);
  const bookCol = firstExistingColumn(cols, bookIdCandidates);
  const foreignCol = firstExistingColumn(cols, foreignIdCandidates);

  if (!bookCol || !foreignCol) return;

  await dbRun(
    `INSERT OR IGNORE INTO ${joinTable} (${bookCol}, ${foreignCol}) VALUES (?, ?)`,
    [bookId, foreignId]
  );
}

export async function createBook(req, res, next) {
  try {
    const userId = req.session.user.id;

    const {
      title,
      author, // UI/Komfort (String)
      isbn = null,
      price = null,
      format = null,
      notes = null,
      coverUrl = null,

      // Vom Frontend (Array)
      authors = [],
      genres = [],

      // Falls irgendwann statt genres "categories" kommt
      categories = [],
    } = req.body ?? {};

    if (!title) {
      return res.status(400).json({ error: "Titel ist ein Pflichtfeld." });
    }

    const isbn13 = isbn ? String(isbn).trim() : null;
    const defaultPrice =
      price !== null && price !== undefined ? Number(price) : null;

    // 1) BOOKS: Insert oder Update
    let bookId = null;

    if (isbn13) {
      await dbRun(
        `INSERT OR IGNORE INTO books (isbn13, title, cover_url, default_price)
         VALUES (?, ?, ?, ?)`,
        [isbn13, String(title).trim(), coverUrl || null, defaultPrice]
      );

      await dbRun(
        `UPDATE books
         SET title = ?, cover_url = ?, default_price = ?
         WHERE isbn13 = ?`,
        [String(title).trim(), coverUrl || null, defaultPrice, isbn13]
      );

      const row = await dbGet(`SELECT id FROM books WHERE isbn13 = ?`, [isbn13]);
      bookId = row?.id ?? null;
    } else {
      const result = await dbRun(
        `INSERT INTO books (isbn13, title, cover_url, default_price)
         VALUES (?, ?, ?, ?)`,
        [null, String(title).trim(), coverUrl || null, defaultPrice]
      );
      bookId = result.lastID;
    }

    if (!bookId) {
      return res
        .status(500)
        .json({ error: "Buch konnte nicht gespeichert werden (bookId fehlt)." });
    }

    // 2) USER_BOOKS: User-spezifische Daten speichern
    const formatId = FORMAT_MAP[String(format)] ?? null;
    const pricePaid =
      price !== null && price !== undefined ? Number(price) : null;

    await dbRun(
      `INSERT OR IGNORE INTO user_books (user_id, book_id, format_id, notes, price_paid)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, bookId, formatId, notes || null, pricePaid]
    );

    await dbRun(
      `UPDATE user_books
       SET format_id = COALESCE(?, format_id),
           notes = COALESCE(?, notes),
           price_paid = COALESCE(?, price_paid)
       WHERE user_id = ? AND book_id = ?`,
      [formatId, notes || null, pricePaid, userId, bookId]
    );

    // 3) AUTHORS + GENRES (optional)
    const hasAuthors = await tableExists("authors");
    const hasBookAuthors = await tableExists("book_authors");
    const hasGenres = await tableExists("genres");
    const hasBookGenres = await tableExists("book_genres");

    // --- AUTHORS ---
    if (hasAuthors && hasBookAuthors) {
      let authorList = normalizeList(authors);
      if (authorList.length === 0 && author) {
        authorList = normalizeList(author);
      }

      for (const a of authorList) {
        const authorId = await insertLookupId({
          table: "authors",
          value: a,
          idColCandidates: ["id", "author_id"],
          valueColCandidates: ["name", "author", "full_name"],
        });

        await linkJoin({
          joinTable: "book_authors",
          bookId,
          foreignId: authorId,
          bookIdCandidates: ["book_id", "books_id"],
          foreignIdCandidates: ["author_id", "authors_id"],
        });
      }
    }

    // --- GENRES ---
    if (hasGenres && hasBookGenres) {
      // Wir akzeptieren genres ODER categories
      const rawGenreList = normalizeList(genres).length > 0
        ? normalizeList(genres)
        : normalizeList(categories);

      const genreList = splitGenreParts(rawGenreList);

      for (const g of genreList) {
        const genreId = await insertLookupId({
          table: "genres",
          value: g,
          idColCandidates: ["id", "genre_id"],
          valueColCandidates: ["name", "genre", "title"],
        });

        await linkJoin({
          joinTable: "book_genres",
          bookId,
          foreignId: genreId,
          bookIdCandidates: ["book_id", "books_id"],
          foreignIdCandidates: ["genre_id", "genres_id"],
        });
      }
    }

    return res.status(201).json({
      ok: true,
      bookId,
      saved: {
        title,
        isbn13,
        coverUrl,
        defaultPrice,
        formatId,
        pricePaid,
        authorsCount: Array.isArray(authors) ? authors.length : 0,
        genresCount:
          (Array.isArray(genres) ? genres.length : 0) +
          (Array.isArray(categories) ? categories.length : 0),
      },
    });
  } catch (err) {
    next(err);
  }
}
