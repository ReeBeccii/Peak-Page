import { dbAll, dbGet, dbRun } from "../db/db.js";
import { getVolume, mapVolumeToBookRow } from "../services/googleBooks.service.js";

export async function getBooks(req, res) {
  const books = await dbAll(`
    SELECT
      id,
      isbn13,
      title,
      cover_url,
      default_price,
      created_at
    FROM books
    ORDER BY title ASC
  `);

  res.json(books);
}

export async function getBookById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID" });
  }

  const book = await dbGet(
    `
    SELECT
      id,
      isbn13,
      title,
      cover_url,
      default_price,
      created_at
    FROM books
    WHERE id = ?
    `,
    [id]
  );

  if (!book) {
    return res.status(404).json({ error: "Buch nicht gefunden" });
  }

  res.json(book);
}

export async function importBookFromGoogle(req, res) {
  const google_id = req.body?.google_id;
  if (!google_id) return res.status(400).json({ error: "google_id fehlt" });

  const volume = await getVolume(google_id);
  const row = mapVolumeToBookRow(volume);

  // Duplikate vermeiden (wenn ISBN13 da ist)
  if (row.isbn13) {
    const existing = await dbGet(`SELECT id FROM books WHERE isbn13 = ?`, [row.isbn13]);
    if (existing) {
      return res.status(200).json({ message: "Buch existiert bereits", id: existing.id });
    }
  }

  const result = await dbRun(
    `INSERT INTO books (isbn13, title, cover_url, default_price)
     VALUES (?, ?, ?, ?)`,
    [row.isbn13, row.title, row.cover_url, row.default_price]
  );

  res.status(201).json({ message: "Buch importiert", id: result.lastID, book: row });
}
