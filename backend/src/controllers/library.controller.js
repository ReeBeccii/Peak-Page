// backend/src/controllers/library.controller.js
import { dbAll, dbGet, dbRun } from "../db/db.js";

// ==================================================
// BIBLIOTHEK
// Zuständig für das Laden, Bearbeiten und Löschen von Bibliotheks-Einträgen (user_books)
// ==================================================

/**
 * GET /api/library?status=finished|unread
 * Liefert Bücher für den eingeloggten Benutzer inkl. Buchdaten + Autor:innen + Genres.
 */
export async function listLibrary(req, res) {
  try {
    // --------------------------------------------------
    // 1) Login-Prüfung + Filter vorbereiten
    // --------------------------------------------------
    // Ohne eingeloggten Benutzer gibt es 401.
    // Status wird als Query-Parameter erwartet (Default: finished).

    const userId = req.session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Nicht eingeloggt." });

    const status = (req.query.status || "finished").toString();

    // --------------------------------------------------
    // 2) Basisdaten laden (user_books + books + formats)
    // --------------------------------------------------
    // Holt die bibliotheksrelevanten Felder aus user_books,
    // ergänzt um Buchinfos (books) und das Format (formats).

    const rows = await dbAll(
      `
      SELECT
        ub.id              AS userBookId,
        ub.status          AS status,
        ub.rating          AS rating,
        ub.notes           AS notes,
        ub.price_paid      AS pricePaid,
        ub.finished_at     AS finishedAt,

        b.id               AS bookId,
        b.title            AS title,
        b.isbn13           AS isbn13,
        b.cover_url        AS coverUrl,

        f.name             AS format
      FROM user_books ub
      JOIN books b   ON b.id = ub.book_id
      JOIN formats f ON f.id = ub.format_id
      WHERE ub.user_id = ?
        AND ub.status = ?
      ORDER BY ub.finished_at DESC, ub.id DESC
      `,
      [userId, status]
    );

    // --------------------------------------------------
    // 3) Autor:innen & Genres nachladen (pro Buch)
    // --------------------------------------------------
    // Einfach & robust: pro bookId werden Autor:innen und Genres separat geladen.
    // (Hinweis: Das ist bewusst nicht per großem JOIN gelöst.)

    const books = [];
    for (const r of rows) {
      const authorsRows = await dbAll(
        `
        SELECT a.name
        FROM book_authors ba
        JOIN authors a ON a.id = ba.author_id
        WHERE ba.book_id = ?
        ORDER BY a.name ASC
        `,
        [r.bookId]
      );

      const genresRows = await dbAll(
        `
        SELECT g.name
        FROM book_genres bg
        JOIN genres g ON g.id = bg.genre_id
        WHERE bg.book_id = ?
        ORDER BY g.name ASC
        `,
        [r.bookId]
      );

      // Lesejahr aus finishedAt ableiten (wenn vorhanden), sonst null.
      const finishedYear =
        r.finishedAt ? Number(String(r.finishedAt).slice(0, 4)) : null;

      books.push({
        userBookId: r.userBookId,
        status: r.status,
        rating: r.rating,
        notes: r.notes,
        pricePaid: r.pricePaid,
        finishedAt: r.finishedAt,
        finishedYear,

        book: {
          id: r.bookId,
          title: r.title,
          isbn13: r.isbn13,
          coverUrl: r.coverUrl,
        },

        format: r.format,
        authors: authorsRows.map((x) => x.name),
        genres: genresRows.map((x) => x.name),
      });
    }

    return res.json({ ok: true, books });
  } catch (err) {
    // --------------------------------------------------
    // Fehlerbehandlung
    // --------------------------------------------------
    // Loggt den Fehler serverseitig und gibt eine allgemeine Fehlermeldung zurück.

    console.error("❌ listLibrary Fehler:", err);
    return res.status(500).json({ error: "Serverfehler beim Laden." });
  }
}

// ==================================================
// BIBLIOTHEK-EINTRAG AKTUALISIEREN
// Zuständig für das Bearbeiten eines vorhandenen user_books Eintrags
// ==================================================

/**
 * PATCH /api/library/:userBookId
 * Erwartet JSON:
 * {
 *   finishedYear, notes, rating, pricePaid, format
 * }
 *
 * Hinweis: finishedYear ist hier Pflicht, da es um "finished"-Einträge geht.
 */
export async function updateUserBook(req, res) {
  try {
    // --------------------------------------------------
    // 1) Login-Prüfung + ID validieren
    // --------------------------------------------------

    const userId = req.session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Nicht eingeloggt." });

    const userBookId = Number(req.params.userBookId);
    if (!Number.isInteger(userBookId)) {
      return res.status(400).json({ error: "Ungültige ID." });
    }

    // --------------------------------------------------
    // 2) Zugriff prüfen
    // --------------------------------------------------
    // Sicherstellen, dass der Eintrag dem eingeloggten Benutzer gehört.

    const existing = await dbGet(
      "SELECT id FROM user_books WHERE id = ? AND user_id = ? LIMIT 1",
      [userBookId, userId]
    );
    if (!existing) {
      return res.status(404).json({ error: "Eintrag nicht gefunden." });
    }

    const { finishedYear, notes, rating, pricePaid, format } = req.body ?? {};

    // --------------------------------------------------
    // 3) finishedYear validieren & finished_at setzen
    // --------------------------------------------------
    // finishedYear ist Pflicht (Bibliothek = finished Bücher).
    // finished_at wird aus dem Jahr gebaut (01.01. YYYY).

    const y = Number(finishedYear);
    if (!Number.isInteger(y) || y < 1000 || y > 9999) {
      return res.status(400).json({ error: "Lesejahr muss ein gültiges Jahr sein." });
    }

    const finishedAt = `${y}-01-01 00:00:00`;

    // --------------------------------------------------
    // 4) rating validieren (optional)
    // --------------------------------------------------
    // Bewertung ist optional, wenn gesetzt dann 1..5.

    let ratingValue = null;
    if (rating !== undefined && rating !== null && String(rating).trim() !== "") {
      const n = Number(rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({ error: "Bewertung muss 1 bis 5 sein." });
      }
      ratingValue = n;
    }

    // --------------------------------------------------
    // 5) pricePaid validieren (optional)
    // --------------------------------------------------
    // Preis ist optional, wenn gesetzt dann Zahl >= 0.

    let priceValue = null;
    if (pricePaid !== undefined && pricePaid !== null && String(pricePaid).trim() !== "") {
      const p = Number(pricePaid);
      if (!Number.isFinite(p) || p < 0) {
        return res.status(400).json({ error: "Preis muss eine Zahl >= 0 sein." });
      }
      priceValue = p;
    }

    // --------------------------------------------------
    // 6) Format auf format_id abbilden
    // --------------------------------------------------
    // Wenn das Format nicht gefunden wird, wird ein Fallback (erstes Format) verwendet.

    async function getFormatId(formatValue) {
      const row = await dbGet("SELECT id FROM formats WHERE name = ? LIMIT 1", [formatValue]);
      if (row?.id) return row.id;

      const fallback = await dbGet("SELECT id FROM formats ORDER BY id ASC LIMIT 1");
      if (fallback?.id) return fallback.id;

      throw new Error("formats Tabelle ist leer.");
    }

    const formatId = await getFormatId(format);

    // --------------------------------------------------
    // 7) Update speichern
    // --------------------------------------------------

    await dbRun(
      `
      UPDATE user_books
      SET
        format_id = ?,
        rating = ?,
        notes = ?,
        price_paid = ?,
        finished_at = ?
      WHERE id = ? AND user_id = ?
      `,
      [
        formatId,
        ratingValue,
        notes?.toString().trim() || null,
        priceValue,
        finishedAt,
        userBookId,
        userId,
      ]
    );

    return res.json({ ok: true });
  } catch (err) {
    // --------------------------------------------------
    // Fehlerbehandlung
    // --------------------------------------------------

    console.error("❌ updateUserBook Fehler:", err);
    return res.status(500).json({ error: "Serverfehler beim Speichern." });
  }
}

// ==================================================
// BIBLIOTHEK-EINTRAG LÖSCHEN
// Zuständig für das Entfernen eines user_books Eintrags (Buch bleibt bestehen)
// ==================================================

/**
 * DELETE /api/library/:userBookId
 * Löscht NUR den user_books Eintrag (das Buch in books bleibt erhalten).
 */
export async function deleteUserBook(req, res) {
  try {
    // --------------------------------------------------
    // 1) Login-Prüfung + ID validieren
    // --------------------------------------------------

    const userId = req.session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Nicht eingeloggt." });

    const userBookId = Number(req.params.userBookId);
    if (!Number.isInteger(userBookId)) {
      return res.status(400).json({ error: "Ungültige ID." });
    }

    // --------------------------------------------------
    // 2) Löschen ausführen
    // --------------------------------------------------
    // Löscht den Eintrag nur, wenn er dem Benutzer gehört.

    const del = await dbRun(
      "DELETE FROM user_books WHERE id = ? AND user_id = ?",
      [userBookId, userId]
    );

    if (del.changes === 0) {
      return res.status(404).json({ error: "Eintrag nicht gefunden." });
    }

    return res.json({ ok: true });
  } catch (err) {
    // --------------------------------------------------
    // Fehlerbehandlung
    // --------------------------------------------------

    console.error("❌ deleteUserBook Fehler:", err);
    return res.status(500).json({ error: "Serverfehler beim Löschen." });
  }
}