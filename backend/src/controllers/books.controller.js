// src/controllers/books.controller.js
import { dbAll, dbGet, dbRun } from "../db/db.js";

// Hilfsfunktion: User muss eingeloggt sein
function requireUser(req, res) {
  const user = req.session?.user;
  if (!user?.id) {
    res.status(401).json({ error: "Nicht eingeloggt." });
    return null;
  }
  return user;
}

// GET /api/books  -> alle Bücher des eingeloggten Users (über user_books)
export async function listMyBooks(req, res, next) {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    // Hinweis: authors/genres holen wir später per JOIN nach, wenn du willst.
    const rows = await dbAll(
      `
      SELECT
        b.id,
        b.isbn13,
        b.title,
        b.cover_url,
        b.default_price,
        ub.format_id,
        ub.status,
        ub.rating,
        ub.notes,
        ub.price_paid,
        ub.started_at,
        ub.finished_at,
        ub.last_read_at,
        b.created_at
      FROM user_books ub
      JOIN books b ON b.id = ub.book_id
      WHERE ub.user_id = ?
      ORDER BY b.created_at DESC
      `,
      [user.id]
    );

    res.json({ ok: true, books: rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/books  -> Buch + user_books speichern (inkl authors/genres via deinem create controller)
export async function createBook(req, res, next) {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    // Wir leiten an deinen create-Flow weiter:
    // Damit du nur einen "Source of Truth" hast.
    // Falls du create schon in einer extra Datei hast (books.create.controller.js),
    // dann solltest du in routes direkt diese Datei verwenden.
    //
    // Hier fallback: wir erwarten, dass du die Logik bereits in books.create.controller.js hast.
    return next(new Error("createBook Controller ist nicht verdrahtet. Bitte books.routes.js prüfen."));
  } catch (err) {
    next(err);
  }
}

// GET /api/books/:id -> einzelnes Buch (optional)
export async function getBookById(req, res, next) {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Ungültige ID." });
    }

    const row = await dbGet(
      `
      SELECT
        b.*,
        ub.format_id,
        ub.status,
        ub.rating,
        ub.notes,
        ub.price_paid,
        ub.started_at,
        ub.finished_at,
        ub.last_read_at
      FROM user_books ub
      JOIN books b ON b.id = ub.book_id
      WHERE ub.user_id = ? AND b.id = ?
      `,
      [user.id, id]
    );

    if (!row) return res.status(404).json({ error: "Nicht gefunden." });

    res.json({ ok: true, book: row });
  } catch (err) {
    next(err);
  }
}
