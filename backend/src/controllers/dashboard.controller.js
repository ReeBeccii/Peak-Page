// src/controllers/dashboard.controller.js
import { dbGet } from "../db/db.js";

// ==================================================
// DASHBOARD
// Zuständig für Kennzahlen und Zusammenfassungen pro eingeloggtem Benutzer
// ==================================================

/**
 * GET /api/dashboard
 * Liefert die wichtigsten Kennzahlen fürs Dashboard (pro eingeloggtem User).
 */
export async function getDashboard(req, res) {
  try {
    // --------------------------------------------------
    // 1) Login-Prüfung
    // --------------------------------------------------
    // Holt die User-ID aus der Session. Ohne Login gibt es 401.

    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Nicht eingeloggt." });
    }

    const year = new Date().getFullYear();
    const yearStr = String(year);

    // --------------------------------------------------
    // 2) Gesamtanzahl Bücher
    // --------------------------------------------------
    // Zählt alle user_books Einträge des Benutzers (entspricht „Bücher insgesamt“).

    const totalRow = await dbGet(
      `SELECT COUNT(*) AS cnt
       FROM user_books
       WHERE user_id = ?`,
      [userId]
    );

    // --------------------------------------------------
    // 3) Dieses Jahr gelesen
    // --------------------------------------------------
    // Zählt alle Bücher mit Status "finished", deren finished_at im aktuellen Jahr liegt.

    const yearReadRow = await dbGet(
      `SELECT COUNT(*) AS cnt
       FROM user_books
       WHERE user_id = ?
         AND status = 'finished'
         AND finished_at IS NOT NULL
         AND strftime('%Y', finished_at) = ?`,
      [userId, yearStr]
    );

    // --------------------------------------------------
    // 4) Ausgaben gesamt
    // --------------------------------------------------
    // Summiert price_paid; wenn nicht vorhanden, wird default_price aus books verwendet.

    const spendRow = await dbGet(
      `SELECT COALESCE(SUM(COALESCE(ub.price_paid, b.default_price)), 0) AS sum
       FROM user_books ub
       JOIN books b ON b.id = ub.book_id
       WHERE ub.user_id = ?`,
      [userId]
    );

    // --------------------------------------------------
    // 5) Zuletzt gelesen
    // --------------------------------------------------
    // Ermittelt das zuletzt als "finished" markierte Buch inkl. Cover, Titel und Autor:innen.
    // Autor:innen werden per GROUP_CONCAT über authors/book_authors zusammengeführt.

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

    // --------------------------------------------------
    // 6) Offene Leihen (optional)
    // --------------------------------------------------
    // Prüft zuerst, ob die Tabelle "loans" existiert.
    // Falls ja: zählt alle Leihen ohne returned_at (also noch nicht zurückgegeben).

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

    // --------------------------------------------------
    // Antwort fürs Frontend
    // --------------------------------------------------
    // Gibt Kennzahlen + optional lastRead-Objekt zurück (oder null, wenn nichts gefunden).

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
    // --------------------------------------------------
    // Fehlerbehandlung
    // --------------------------------------------------
    // Loggt den Fehler serverseitig und liefert eine allgemeine Fehlermeldung zurück.

    console.error("❌ dashboard Fehler:", err);
    return res.status(500).json({ error: "Serverfehler im Dashboard." });
  }
}