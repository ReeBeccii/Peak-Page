// backend/src/services/booksLocalLookup.service.js
import { dbGet, dbAll } from "../db/db.js";

// ==================================================
// LOKALE BUCHSUCHE (DB-FIRST)
// Zuständig für das Finden von Büchern anhand der ISBN in der lokalen Datenbank
// ==================================================

/**
 * Sucht ein Buch anhand der ISBN in der lokalen Datenbank.
 *
 * Ablauf:
 * - ISBN bereinigen (nur Ziffern + X)
 * - Buch in books suchen
 * - Autor:innen und Genres nachladen
 * - Rückgabe im gleichen Format wie externe Buchquellen (z. B. Google Books)
 *
 * @param {string} isbn - ISBN aus Request (beliebiges Format)
 * @returns {object|null} Buchdaten oder null, wenn nichts gefunden wurde
 */
export async function findLocalBookByIsbn(isbn) {
  // --------------------------------------------------
  // ISBN bereinigen
  // --------------------------------------------------
  // Entfernt Bindestriche, Leerzeichen und sonstige Zeichen.
  // Erlaubt bleiben nur Ziffern sowie X/x.

  const clean = String(isbn || "").replace(/[^0-9Xx]/g, "").trim();
  if (!clean) return null;

  // --------------------------------------------------
  // Buch-Grunddaten laden
  // --------------------------------------------------

  const book = await dbGet(
    `SELECT id, isbn13, title, cover_url, default_price
     FROM books
     WHERE isbn13 = ?
     LIMIT 1`,
    [clean]
  );

  if (!book?.id) return null;

  // --------------------------------------------------
  // Autor:innen nachladen
  // --------------------------------------------------

  const authorRows = await dbAll(
    `SELECT a.name
     FROM authors a
     JOIN book_authors ba ON ba.author_id = a.id
     WHERE ba.book_id = ?`,
    [book.id]
  );

  // --------------------------------------------------
  // Genres nachladen
  // --------------------------------------------------

  const genreRows = await dbAll(
    `SELECT g.name
     FROM genres g
     JOIN book_genres bg ON bg.genre_id = g.id
     WHERE bg.book_id = ?`,
    [book.id]
  );

  // --------------------------------------------------
  // Daten aufbereiten
  // --------------------------------------------------

  const authors = authorRows.map(r => r.name).filter(Boolean);
  const categories = genreRows.map(r => r.name).filter(Boolean);

  // --------------------------------------------------
  // Einheitliches Rückgabeformat
  // --------------------------------------------------
  // Felder wie publishedYear oder description sind bewusst null,
  // da sie in der lokalen DB nicht vorhanden sind.

  return {
    title: book.title ?? null,
    author: authors.length ? authors.join(", ") : null,
    authors,
    categories,
    publishedYear: null,      // nicht in der lokalen DB vorhanden
    isbn: book.isbn13 ?? clean,
    description: null,        // nicht in der lokalen DB vorhanden
    coverUrl: book.cover_url ?? null,
    defaultPrice: book.default_price ?? null,
    source: "db",
  };
}