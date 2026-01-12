import { dbAll, dbGet } from "../db/db.js";

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

  const book = await dbGet(`
    SELECT
      id,
      isbn13,
      title,
      cover_url,
      default_price,
      created_at
    FROM books
    WHERE id = ?
  `, [id]);

  if (!book) {
    return res.status(404).json({ error: "Buch nicht gefunden" });
  }

  res.json(book);
}
