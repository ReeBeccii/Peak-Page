// src/controllers/googleBooks.controller.js
import { fetchGoogleVolumeByIsbn, mapVolumeToBook } from "../services/googleBooks.service.js";
import { findLocalBookByIsbn } from "../services/booksLocalLookup.service.js";

export async function getByIsbn(req, res, next) {
  try {
    const isbn = req.query.isbn;

    if (!isbn) {
      return res.status(400).json({ error: "Bitte isbn als Query-Parameter angeben." });
    }

    // 1) DB-FIRST: Erst lokal schauen
    const local = await findLocalBookByIsbn(isbn);
    if (local) {
      // gleiche Response-Form wie bei Google, damit Frontend nichts umbauen muss
      return res.json({ ok: true, book: local });
    }

    // 2) Nur wenn nicht lokal vorhanden: Google fragen
    const item = await fetchGoogleVolumeByIsbn(isbn);

    if (!item) {
      return res.status(404).json({ error: "Kein Buch zu dieser ISBN gefunden." });
    }

    const book = mapVolumeToBook(item, isbn);

    if (!book || !book.title) {
      return res.status(404).json({ error: "Buchdaten unvollständig." });
    }

    // optional: Quelle markieren (für Debug/Doku)
    return res.json({ ok: true, book: { ...book, source: "google" } });
  } catch (err) {
    // optional: 429 "schön" rausgeben statt als 500 zu enden
    if (err?.status === 429) {
      return res.status(429).json({
        error: "Google Books API Rate-Limit erreicht (429). Bitte später erneut versuchen.",
      });
    }
    next(err);
  }
}