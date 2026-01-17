// src/controllers/dashboard.controller.js
import { dbGet } from "../db/db.js";

/**
 * GET /api/dashboard
 * Liefert Kennzahlen fürs Dashboard (pro eingeloggtem User)
 */
export async function getDashboard(req, res) {
  try {
    // 1) Login check
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Nicht eingeloggt." });
    }

    const year = new Date().getFullYear();
    const yearStr = String(year);

    // 2) Gesamt Bücher (Anzahl user_books Einträge)
    const totalRow = await dbGet(
      `SELECT COUNT(*) AS cnt
       FROM user_books
       WHERE user_id = ?`,
      [userId]
    );

    // 3) Dieses Jahr gelesen (finished im aktuellen Jahr)
    const yearReadRow = await dbGet(
      `SELECT COUNT(*) AS cnt
       FROM user_books
       WHERE user_id = ?
         AND status = 'finished'
         AND finished_at IS NOT NULL
         AND strftime('%Y', finished_at) = ?`,
      [userId, yearStr]
    );

    // 4) Ausgaben gesamt (price_paid, fallback default_price)
    const spendRow = await dbGet(
      `SELECT COALESCE(SUM(COALESCE(ub.price_paid, b.default_price)), 0) AS sum
       FROM user_books ub
       JOIN books b ON b.id = ub.book_id
       WHERE ub.user_id = ?`,
      [userId]
    );

    // 5) Zuletzt gelesen (Objekt: cover + titel + autor)
    // Autor via GROUP_CONCAT über authors/book_authors
    const lastReadRow = await dbGet(
      `SELECT
         b.title AS title,
         b.cover_url AS cover_url,
         GROUP_CONCAT(a.name, ', ') AS author
       FROM user_books ub
       JOIN books b ON b.id = ub.book_id
       LEFT JOIN book_authors ba ON ba.book_id = b.id
       LEFT JOIN authors a ON a.id = ba.author_id
       WHERE ub.user_id = ?
         AND ub.status = 'finished'
         AND ub.finished_at IS NOT NULL
       GROUP BY b.id, ub.finished_at
       ORDER BY ub.finished_at DESC
       LIMIT 1`,
      [userId]
    );

    // 6) Offene Leihen (falls loans Tabelle existiert)
    let loansOpen = 0;
    const loansTable = await dbGet(
      `SELECT 1 AS ok
       FROM sqlite_master
       WHERE type='table' AND name='loans'
       LIMIT 1`
    );

    if (loansTable?.ok) {
      const loansRow = await dbGet(
        `SELECT COUNT(*) AS cnt
         FROM loans
         WHERE user_id = ?
           AND returned_at IS NULL`,
        [userId]
      );
      loansOpen = Number(loansRow?.cnt ?? 0);
    }

    return res.json({
      ok: true,
      total: Number(totalRow?.cnt ?? 0),
      yearRead: Number(yearReadRow?.cnt ?? 0),
      spendTotal: Number(spendRow?.sum ?? 0),
      loansOpen,
      year,
      lastRead: lastReadRow
        ? {
            title: lastReadRow.title ?? "",
            author: lastReadRow.author ?? "",
            cover_url: lastReadRow.cover_url ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("❌ dashboard Fehler:", err);
    return res.status(500).json({ error: "Serverfehler im Dashboard." });
  }
}
