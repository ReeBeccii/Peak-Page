// backend/src/controllers/userBooks.controller.js
import { dbAll, dbGet, dbRun } from "../db/db.js";

// ==================================================
// USER-REGAL (user_books)
// Zuständig für Laden, Anlegen, Aktualisieren und Löschen von Regal-Einträgen
// ==================================================

/**
 * GET /api/user-books?user_id=...
 * Liefert das Regal eines Benutzers (user_books) inkl. Basis-Buchdaten und Autor:innen-Text.
 */
export async function listUserBooks(req, res) {
  const userId = Number(req.query.user_id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: "Query-Parameter user_id fehlt oder ist ungültig" });
  }

  const rows = await dbAll(
    `SELECT
     ub.id,
     ub.user_id,
     ub.book_id,
     ub.format_id,
     ub.status,
     ub.rating,
     ub.notes,
     ub.price_paid,
     ub.started_at,
     ub.finished_at,
     ub.last_read_at,
     b.title,
     b.isbn13,
     b.cover_url,
     b.default_price,
     -- Autor:innen als Text zusammenfassen (z. B. "A, B, C")
     COALESCE(GROUP_CONCAT(a.name, ', '), '') AS author
   FROM user_books ub
   JOIN books b ON b.id = ub.book_id
   LEFT JOIN book_authors ba ON ba.book_id = b.id
   LEFT JOIN authors a ON a.id = ba.author_id
   WHERE ub.user_id = ?
   GROUP BY ub.id
   ORDER BY ub.id DESC`,
    [userId]
  );

  res.json(rows);
}

// ==================================================
// REGAL-EINTRAG ANLEGEN
// Zuständig für das Erstellen eines neuen user_books Eintrags
// ==================================================

/**
 * POST /api/user-books
 * Erstellt einen neuen Regal-Eintrag (user_books) für einen Benutzer und ein Buch.
 */
export async function createUserBook(req, res) {
  const {
    user_id,
    book_id,
    status,
    notes,
    rating,
    format_id,
    price_paid,
    started_at,
    finished_at,
    last_read_at
  } = req.body;

  // --------------------------------------------------
  // Validierung (Pflichtfelder)
  // --------------------------------------------------
  // user_id und book_id müssen Integer sein.

  if (!Number.isInteger(user_id) || !Number.isInteger(book_id)) {
    return res.status(400).json({ error: "user_id und book_id müssen Integer sein" });
  }

  // --------------------------------------------------
  // Validierung (rating)
  // --------------------------------------------------
  // Hier erlaubt: 0..5 (je nach eurer Logik/Frontend).

  if (rating !== undefined && (typeof rating !== "number" || rating < 0 || rating > 5)) {
    return res.status(400).json({ error: "rating muss zwischen 0 und 5 liegen" });
  }

  // --------------------------------------------------
  // Existenzprüfung: Buch muss vorhanden sein
  // --------------------------------------------------

  const bookExists = await dbGet(`SELECT id FROM books WHERE id = ?`, [book_id]);
  if (!bookExists) return res.status(404).json({ error: "book_id existiert nicht" });

  // --------------------------------------------------
  // Insert: user_books
  // --------------------------------------------------

  const result = await dbRun(
    `INSERT INTO user_books
      (user_id, book_id, format_id, status, rating, notes, price_paid, started_at, finished_at, last_read_at)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      book_id,
      format_id ?? null,
      status ?? "unread",
      rating ?? null,
      notes ?? null,
      price_paid ?? null,
      started_at ?? null,
      finished_at ?? null,
      last_read_at ?? null
    ]
  );

  res.status(201).json({ id: result.lastID, message: "Regal-Eintrag erstellt" });
}

// ==================================================
// REGAL-EINTRAG AKTUALISIEREN
// Zuständig für das Bearbeiten eines bestehenden user_books Eintrags
// ==================================================

/**
 * PUT/PATCH /api/user-books/:id
 * Aktualisiert Felder eines Regal-Eintrags.
 *
 * Unterstützt u. a.:
 * - status (unread | finished)
 * - rating (1..5)
 * - notes
 * - format_id oder format (Name aus dem Frontend)
 * - price_paid oder pricePaid (Alias aus dem Frontend)
 * - started_at / finished_at / last_read_at
 */
export async function updateUserBook(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ungültige ID" });

  const {
    status,
    notes,
    rating,
    format_id,
    format,          // erlaubt: "ebook" | "paperback" | ...
    price_paid,
    pricePaid,       // Alias (Frontend): pricePaid
    started_at,
    finished_at,
    last_read_at
  } = req.body ?? {};

  // --------------------------------------------------
  // Validierung: rating (optional)
  // --------------------------------------------------
  // Erlaubt: 1..5 oder null/undefined.

  if (rating !== undefined && rating !== null) {
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating muss zwischen 1 und 5 liegen" });
    }
  }

  // --------------------------------------------------
  // Validierung: status (optional)
  // --------------------------------------------------
  // Wenn status gesetzt wird, muss er in der erlaubten Liste sein.

  const allowedStatus = new Set(["unread", "finished"]);
  if (status !== undefined && status !== null && !allowedStatus.has(status)) {
    return res.status(400).json({ error: "Ungültiger Status. Erlaubt: unread, finished." });
  }

  // --------------------------------------------------
  // Existenzprüfung: Eintrag muss existieren
  // --------------------------------------------------

  const existing = await dbGet(
    `SELECT id, status, finished_at FROM user_books WHERE id = ?`,
    [id]
  );
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden" });

  // --------------------------------------------------
  // Format ermitteln
  // --------------------------------------------------
  // Wenn das Frontend "format" (Name) schickt, wird format_id daraus abgeleitet.

  let finalFormatId = format_id ?? null;
  if (!finalFormatId && format) {
    const row = await dbGet(`SELECT id FROM formats WHERE name = ? LIMIT 1`, [String(format)]);
    if (row?.id) finalFormatId = row.id;
  }

  // --------------------------------------------------
  // Preis-Alias vereinheitlichen
  // --------------------------------------------------
  // Unterstützt sowohl price_paid als auch pricePaid (Frontend).

  const finalPricePaid = (price_paid !== undefined) ? price_paid : pricePaid;

  // --------------------------------------------------
  // finished_at Logik bei Statuswechsel
  // --------------------------------------------------
  // - Wechsel zu "finished": wenn kein Datum kommt -> automatisch "jetzt"
  // - Wechsel zu "unread": finished_at wird bewusst entfernt (zurück in SuB)

  let finalFinishedAt = finished_at ?? null;

  if (status === "finished") {
    if (!finalFinishedAt) {
      finalFinishedAt = "AUTO_NOW";
    }
  }

  if (status === "unread") {
    finalFinishedAt = "FORCE_NULL";
  }

  // --------------------------------------------------
  // SQL-Baustein: finished_at dynamisch setzen
  // --------------------------------------------------
  // AUTO_NOW  -> datetime('now')
  // FORCE_NULL -> NULL
  // sonst     -> COALESCE(?, finished_at) (nur überschreiben, wenn Wert geliefert wurde)

  let finishedAtSql = "COALESCE(?, finished_at)";
  let finishedAtParam = finalFinishedAt;

  if (finalFinishedAt === "AUTO_NOW") {
    finishedAtSql = "datetime('now')";
    finishedAtParam = null;
  } else if (finalFinishedAt === "FORCE_NULL") {
    finishedAtSql = "NULL";
    finishedAtParam = null;
  }

  // --------------------------------------------------
  // Update ausführen
  // --------------------------------------------------

  const sql = `
    UPDATE user_books
    SET status       = COALESCE(?, status),
        notes        = COALESCE(?, notes),
        rating       = COALESCE(?, rating),
        format_id    = COALESCE(?, format_id),
        price_paid   = COALESCE(?, price_paid),
        started_at   = COALESCE(?, started_at),
        finished_at  = ${finishedAtSql},
        last_read_at = COALESCE(?, last_read_at)
    WHERE id = ?
  `;

  const result = await dbRun(sql, [
    status ?? null,
    notes ?? null,
    rating ?? null,
    finalFormatId ?? null,
    (finalPricePaid !== undefined ? finalPricePaid : null),
    started_at ?? null,
    // Parameter für finished_at nur wenn COALESCE genutzt wird
    ...(finishedAtSql.startsWith("COALESCE") ? [finishedAtParam] : []),
    last_read_at ?? null,
    id
  ]);

  res.json({ ok: true, message: "Eintrag aktualisiert", changes: result.changes });
}

// ==================================================
// REGAL-EINTRAG LÖSCHEN
// Zuständig für das Entfernen eines user_books Eintrags (nur eigener Benutzer)
// ==================================================

/**
 * DELETE /api/user-books/:id
 * Löscht einen Regal-Eintrag.
 *
 * Wichtig:
 * - User wird aus der Session gelesen (nicht aus Body)
 * - Es wird geprüft, ob der Eintrag dem User gehört
 */
export async function deleteUserBook(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ungültige ID" });

  // Benutzer aus Session lesen (nicht aus dem Request-Body)
  const userId = req.session?.user?.id;
  if (!userId) return res.status(401).json({ error: "Nicht eingeloggt." });

  // Prüfen, ob der Eintrag existiert und dem Benutzer gehört
  const existing = await dbGet(
    `SELECT id FROM user_books WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden oder gehört nicht dem User" });

  const result = await dbRun(`DELETE FROM user_books WHERE id = ?`, [id]);
  res.json({ ok: true, message: "Eintrag gelöscht", changes: result.changes });
}