import { dbAll, dbGet, dbRun } from "../db/db.js";

/**
 * GET /api/user-books?user_id=...
 * Liefert das Regal eines Users
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
     -- ✅ Autor(en) als Text dazupacken
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

/**
 * POST /api/user-books
 * Erstellt einen Regal-Eintrag
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

  if (!Number.isInteger(user_id) || !Number.isInteger(book_id)) {
    return res.status(400).json({ error: "user_id und book_id müssen Integer sein" });
  }

  if (rating !== undefined && (typeof rating !== "number" || rating < 0 || rating > 5)) {
    return res.status(400).json({ error: "rating muss zwischen 0 und 5 liegen" });
  }

  const bookExists = await dbGet(`SELECT id FROM books WHERE id = ?`, [book_id]);
  if (!bookExists) return res.status(404).json({ error: "book_id existiert nicht" });

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
/**
 * PUT/PATCH /api/user-books/:id
 * Aktualisiert einen Regal-Eintrag
 */
export async function updateUserBook(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ungültige ID" });

  const {
    status,
    notes,
    rating,
    format_id,
    format,          // ✅ erlaubt: "ebook" | "paperback" | ...
    price_paid,
    pricePaid,       // ✅ erlaubt (Frontend): pricePaid
    started_at,
    finished_at,
    last_read_at
  } = req.body ?? {};

  // rating 1..5 oder null/undefined
  if (rating !== undefined && rating !== null) {
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating muss zwischen 1 und 5 liegen" });
    }
  }

  // status prüfen (wenn geschickt)
  const allowedStatus = new Set(["unread", "finished"]);
  if (status !== undefined && status !== null && !allowedStatus.has(status)) {
    return res.status(400).json({ error: "Ungültiger Status. Erlaubt: unread, finished." });
  }

  const existing = await dbGet(
    `SELECT id, status, finished_at FROM user_books WHERE id = ?`,
    [id]
  );
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden" });

  // ✅ format_id ermitteln, wenn Frontend "format" schickt
  let finalFormatId = format_id ?? null;
  if (!finalFormatId && format) {
    const row = await dbGet(`SELECT id FROM formats WHERE name = ? LIMIT 1`, [String(format)]);
    if (row?.id) finalFormatId = row.id;
  }

  // ✅ pricePaid alias
  const finalPricePaid = (price_paid !== undefined) ? price_paid : pricePaid;

  // ✅ finished_at Logik bei Statuswechsel
  let finalFinishedAt = finished_at ?? null;

  if (status === "finished") {
    // wenn user kein finished_at schickt: automatisch setzen
    if (!finalFinishedAt) {
      finalFinishedAt = "AUTO_NOW";
    }
  }

  if (status === "unread") {
    // zurück in SuB -> finished_at weg
    finalFinishedAt = "FORCE_NULL";
  }

  // SQL: finished_at dynamisch (AUTO_NOW / FORCE_NULL / normal COALESCE)
  let finishedAtSql = "COALESCE(?, finished_at)";
  let finishedAtParam = finalFinishedAt;

  if (finalFinishedAt === "AUTO_NOW") {
    finishedAtSql = "datetime('now')";
    finishedAtParam = null;
  } else if (finalFinishedAt === "FORCE_NULL") {
    finishedAtSql = "NULL";
    finishedAtParam = null;
  }

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


/**
 * DELETE /api/user-books/:id
 * Löscht einen Regal-Eintrag (nur eigener User)
 */
export async function deleteUserBook(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Ungültige ID" });

  // ✅ user aus Session statt Body
  const userId = req.session?.user?.id;
  if (!userId) return res.status(401).json({ error: "Nicht eingeloggt." });

  const existing = await dbGet(
    `SELECT id FROM user_books WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden oder gehört nicht dem User" });

  const result = await dbRun(`DELETE FROM user_books WHERE id = ?`, [id]);
  res.json({ ok: true, message: "Eintrag gelöscht", changes: result.changes });
}

