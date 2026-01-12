import { dbGet, dbRun } from "../db/db.js";

export async function createUserBook(req, res) {
  const { user_id, book_id, status, note, rating, format_id } = req.body;

  // Minimal-Checks
  if (!Number.isInteger(user_id) || !Number.isInteger(book_id)) {
    return res.status(400).json({ error: "user_id und book_id müssen Integer sein" });
  }

  // Optional: rating prüfen
  if (rating !== undefined && (typeof rating !== "number" || rating < 0 || rating > 5)) {
    return res.status(400).json({ error: "rating muss zwischen 0 und 5 liegen" });
  }

  // Optional: Existenz prüfen (sauber für 404 statt DB-Fehler)
  const bookExists = await dbGet(`SELECT id FROM books WHERE id = ?`, [book_id]);
  if (!bookExists) return res.status(404).json({ error: "book_id existiert nicht" });

  // Insert
  const result = await dbRun(
    `INSERT INTO user_books (user_id, book_id, status, note, rating, format_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user_id, book_id, status ?? null, note ?? null, rating ?? null, format_id ?? null]
  );

  res.status(201).json({ id: result.lastID, message: "Regal-Eintrag erstellt" });
}

export async function updateUserBook(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ungültige ID" });

  const { status, note, rating, format_id } = req.body;

  // Optional rating check
  if (rating !== undefined && (typeof rating !== "number" || rating < 0 || rating > 5)) {
    return res.status(400).json({ error: "rating muss zwischen 0 und 5 liegen" });
  }

  // Existiert der Eintrag?
  const existing = await dbGet(`SELECT id FROM user_books WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden" });

  // Update (nur Felder, die geschickt wurden)
  const result = await dbRun(
    `UPDATE user_books
     SET status = COALESCE(?, status),
         note = COALESCE(?, note),
         rating = COALESCE(?, rating),
         format_id = COALESCE(?, format_id)
     WHERE id = ?`,
    [status ?? null, note ?? null, rating ?? null, format_id ?? null, id]
  );

  res.json({ message: "Eintrag aktualisiert", changes: result.changes });
}

export async function deleteUserBook(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ungültige ID" });

  // Löschkonzept (wie du es beschrieben hast):
  // ✅ User darf nur "seinen" user_books Eintrag löschen,
  // ✅ Bücher-Stammdaten bleiben erhalten.
  //
  // Ohne Auth bauen wir es erstmal simpel:
  // -> client muss user_id mitsenden und wir prüfen es.
  const user_id = Number(req.body?.user_id);
  if (!Number.isInteger(user_id)) return res.status(400).json({ error: "user_id muss im Body mitgesendet werden" });

  const existing = await dbGet(
    `SELECT id FROM user_books WHERE id = ? AND user_id = ?`,
    [id, user_id]
  );
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden oder gehört nicht dem User" });

  const result = await dbRun(`DELETE FROM user_books WHERE id = ?`, [id]);

  res.json({ message: "Eintrag gelöscht", changes: result.changes });
}
