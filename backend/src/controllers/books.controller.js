// src/controllers/books.controller.js
import { dbAll, dbGet, dbRun } from "../db/db.js";

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
// BUCHLISTE
// Zuständig für das Abrufen aller Bücher des eingeloggten Benutzers
// ==================================================

/**
 * GET /api/books
 * Liefert alle Bücher des eingeloggten Benutzers (über user_books).
 */
export async function listMyBooks(req, res, next) {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    // Hinweis: Autoren/Genres können bei Bedarf später per JOIN ergänzt werden.
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

// ==================================================
// BUCH ANLEGEN
// Zuständig für das Anlegen eines Buches inkl. Verknüpfung zum Benutzer
// ==================================================

/**
 * POST /api/books
 * Soll Buch + user_books speichern (inkl. authors/genres über den Create-Flow).
 *
 * Hinweis: Dieser Controller ist aktuell nur ein Platzhalter und muss in den
 * Routing-/Create-Flow korrekt verdrahtet werden.
 */
export async function createBook(req, res, next) {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    // Weiterleitung an den zentralen Create-Flow:
    // Ziel: Nur eine Stelle, die die Create-Logik enthält ("Single Source of Truth").
    //
    // Wenn du bereits einen eigenen Create-Controller hast (z. B. books.create.controller.js),
    // sollten die Routes direkt darauf zeigen.
    //
    // Fallback: Hier wird erwartet, dass die Logik in books.create.controller.js existiert.
    return next(new Error("createBook Controller ist nicht verdrahtet. Bitte books.routes.js prüfen."));
  } catch (err) {
    next(err);
  }
}

// ==================================================
// BUCHDETAILS
// Zuständig für das Abrufen eines einzelnen Buches des eingeloggten Benutzers
// ==================================================

/**
 * GET /api/books/:id
 * Liefert ein einzelnes Buch (optional / je nach Verwendung).
 */
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