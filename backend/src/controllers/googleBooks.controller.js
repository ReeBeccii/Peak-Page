// src/controllers/googleBooks.controller.js
import { fetchGoogleVolumeByIsbn, mapVolumeToBook } from "../services/googleBooks.service.js";
import { findLocalBookByIsbn } from "../services/booksLocalLookup.service.js";

// ==================================================
// GOOGLE BOOKS / ISBN-SUCHE
// Zuständig für das Abrufen von Buchdaten anhand einer ISBN
// ==================================================

/**
 * GET /api/google-books?isbn=...
 * Liefert Buchdaten zu einer ISBN.
 *
 * Ablauf:
 * 1) Zuerst lokal in der eigenen Datenbank suchen
 * 2) Nur wenn dort nichts gefunden wird, Google Books API abfragen
 *
 * Ziel: Externe API-Aufrufe minimieren und ein einheitliches Response-Format liefern.
 */
export async function getByIsbn(req, res, next) {
  try {
    const isbn = req.query.isbn;

    // --------------------------------------------------
    // Eingabe prüfen
    // --------------------------------------------------
    // Die ISBN muss als Query-Parameter vorhanden sein.

    if (!isbn) {
      return res.status(400).json({ error: "Bitte isbn als Query-Parameter angeben." });
    }

    // --------------------------------------------------
    // 1) Lokale Suche (DB-first)
    // --------------------------------------------------
    // Zuerst wird geprüft, ob das Buch bereits lokal existiert.

    const local = await findLocalBookByIsbn(isbn);
    if (local) {
      // Gleiche Response-Struktur wie bei Google,
      // damit das Frontend unabhängig von der Quelle bleibt.
      return res.json({ ok: true, book: local });
    }

    // --------------------------------------------------
    // 2) Externe Suche (Google Books API)
    // --------------------------------------------------
    // Wird nur ausgeführt, wenn das Buch lokal nicht vorhanden ist.

    const item = await fetchGoogleVolumeByIsbn(isbn);

    if (!item) {
      return res.status(404).json({ error: "Kein Buch zu dieser ISBN gefunden." });
    }

    // Rohdaten aus Google in das interne Buch-Format überführen.
    const book = mapVolumeToBook(item, isbn);

    if (!book || !book.title) {
      return res.status(404).json({ error: "Buchdaten unvollständig." });
    }

    // --------------------------------------------------
    // Antwort
    // --------------------------------------------------
    // Optional wird die Quelle markiert (hilfreich für Debugging & Doku).

    return res.json({ ok: true, book: { ...book, source: "google" } });
  } catch (err) {
    // --------------------------------------------------
    // Fehlerbehandlung
    // --------------------------------------------------
    // 429 (Rate-Limit) wird bewusst separat behandelt,
    // damit daraus kein allgemeiner 500-Fehler wird.

    if (err?.status === 429) {
      return res.status(429).json({
        error: "Google Books API Rate-Limit erreicht (429). Bitte später erneut versuchen.",
      });
    }
    next(err);
  }
}