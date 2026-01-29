// src/services/booksLocalLookup.service.js
import { dbGet, dbAll } from "../db/db.js";

export async function findLocalBookByIsbn(isbn) {
  const clean = String(isbn || "").replace(/[^0-9Xx]/g, "").trim();
  if (!clean) return null;

  const book = await dbGet(
    `SELECT id, isbn13, title, cover_url, default_price
     FROM books
     WHERE isbn13 = ?
     LIMIT 1`,
    [clean]
  );

  if (!book?.id) return null;

  const authorRows = await dbAll(
    `SELECT a.name
     FROM authors a
     JOIN book_authors ba ON ba.author_id = a.id
     WHERE ba.book_id = ?`,
    [book.id]
  );

  const genreRows = await dbAll(
    `SELECT g.name
     FROM genres g
     JOIN book_genres bg ON bg.genre_id = g.id
     WHERE bg.book_id = ?`,
    [book.id]
  );

  const authors = authorRows.map(r => r.name).filter(Boolean);
  const categories = genreRows.map(r => r.name).filter(Boolean);

  return {
    title: book.title ?? null,
    author: authors.length ? authors.join(", ") : null,
    authors,
    categories,
    publishedYear: null,      // habt ihr nicht in DB
    isbn: book.isbn13 ?? clean,
    description: null,        // habt ihr nicht in DB
    coverUrl: book.cover_url ?? null,
    defaultPrice: book.default_price ?? null,
    source: "db",
  };
}