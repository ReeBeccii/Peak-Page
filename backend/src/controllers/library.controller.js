// src/controllers/library.controller.js
import { dbAll, dbGet } from "../db/db.js";

/**
 * GET /api/library?status=finished|unread|reading|read&year=2026&author=...&format=...&q=...
 */
export async function listLibraryBooks(req, res) {
  try {
    const userId = req.session.user.id;

    // Query-Params
    let { status = "finished", year = "", author = "", format = "", q = "" } = req.query;

    // ✅ Frontend "read" => DB "finished"
    if (status === "read") status = "finished";

    // Basis-SQL
    // NOTE: GROUP_CONCAT(DISTINCT x) darf in SQLite KEIN eigenes Trennzeichen haben.
    let sql = `
      SELECT
        ub.id AS user_book_id,
        ub.status,
        ub.rating,
        ub.notes,
        ub.price_paid,
        ub.finished_at,
        b.id AS book_id,
        b.title,
        b.isbn13,
        b.cover_url,
        f.name AS format_name,

        COALESCE(GROUP_CONCAT(DISTINCT a.name), '') AS authors,
        COALESCE(GROUP_CONCAT(DISTINCT g.name), '') AS genres

      FROM user_books ub
      JOIN books b ON b.id = ub.book_id
      LEFT JOIN formats f ON f.id = ub.format_id

      LEFT JOIN book_authors ba ON ba.book_id = b.id
      LEFT JOIN authors a ON a.id = ba.author_id

      LEFT JOIN book_genres bg ON bg.book_id = b.id
      LEFT JOIN genres g ON g.id = bg.genre_id

      WHERE ub.user_id = ?
        AND ub.status = ?
    `;

    const params = [userId, status];

    // Jahr filtert nach finished_at (wie du wolltest)
    if (year) {
      sql += ` AND strftime('%Y', ub.finished_at) = ? `;
      params.push(String(year));
    }

    // Autor:in Filter (matcht auf authors.name)
    if (author) {
      sql += ` AND EXISTS (
        SELECT 1
        FROM book_authors ba2
        JOIN authors a2 ON a2.id = ba2.author_id
        WHERE ba2.book_id = b.id AND a2.name = ?
      ) `;
      params.push(author);
    }

    // Format Filter
    if (format) {
      sql += ` AND f.name = ? `;
      params.push(format);
    }

    // Suche Titel/Autor
    if (q) {
      sql += ` AND (
        b.title LIKE ?
        OR EXISTS (
          SELECT 1
          FROM book_authors ba3
          JOIN authors a3 ON a3.id = ba3.author_id
          WHERE ba3.book_id = b.id AND a3.name LIKE ?
        )
      ) `;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += `
      GROUP BY ub.id
      ORDER BY ub.finished_at DESC, ub.id DESC
    `;

    const rows = await dbAll(sql, params);

    // hübscher machen (authors/genres als Arrays)
    const books = rows.map((r) => ({
      userBookId: r.user_book_id,
      status: r.status,
      rating: r.rating,
      notes: r.notes,
      pricePaid: r.price_paid,
      finishedAt: r.finished_at,

      book: {
        id: r.book_id,
        title: r.title,
        isbn13: r.isbn13,
        coverUrl: r.cover_url,
      },

      format: r.format_name || null,
      authors: r.authors ? r.authors.split(",") .map(s => s.trim()).filter(Boolean) : [],
      genres: r.genres ? r.genres.split(",") .map(s => s.trim()).filter(Boolean) : [],
      finishedYear: r.finished_at ? Number(String(r.finished_at).slice(0, 4)) : null,
    }));

    return res.json({ ok: true, books });
  } catch (err) {
    console.error("❌ library list error:", err);
    return res.status(500).json({ error: "Serverfehler beim Laden der Bibliothek." });
  }
}

/**
 * GET /api/library/filters?status=finished|unread|reading|read
 * -> liefert Dropdown-Daten
 */
export async function getLibraryFilters(req, res) {
  try {
    const userId = req.session.user.id;
    let { status = "finished" } = req.query;

    if (status === "read") status = "finished";

    // Jahre (aus finished_at)
    const yearsRows = await dbAll(
      `
      SELECT DISTINCT strftime('%Y', finished_at) AS y
      FROM user_books
      WHERE user_id = ? AND status = ? AND finished_at IS NOT NULL
      ORDER BY y DESC
      `,
      [userId, status]
    );

    // Autoren (nur die Bücher, die in diesem Status beim User vorkommen)
    const authorsRows = await dbAll(
      `
      SELECT DISTINCT a.name AS name
      FROM user_books ub
      JOIN books b ON b.id = ub.book_id
      JOIN book_authors ba ON ba.book_id = b.id
      JOIN authors a ON a.id = ba.author_id
      WHERE ub.user_id = ? AND ub.status = ?
      ORDER BY a.name COLLATE NOCASE
      `,
      [userId, status]
    );

    // Formate (name)
    const formatsRows = await dbAll(
      `
      SELECT DISTINCT f.name AS name
      FROM user_books ub
      LEFT JOIN formats f ON f.id = ub.format_id
      WHERE ub.user_id = ? AND ub.status = ? AND f.name IS NOT NULL
      ORDER BY f.name COLLATE NOCASE
      `,
      [userId, status]
    );

    return res.json({
      ok: true,
      years: yearsRows.map((r) => r.y).filter(Boolean),
      authors: authorsRows.map((r) => r.name).filter(Boolean),
      formats: formatsRows.map((r) => r.name).filter(Boolean),
    });
  } catch (err) {
    console.error("❌ library filters error:", err);
    return res.status(500).json({ error: "Serverfehler beim Laden der Filter." });
  }
}
