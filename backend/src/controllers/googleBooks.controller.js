// src/controllers/googleBooks.controller.js
import { fetchGoogleVolumeByIsbn, mapVolumeToBook } from "../services/googleBooks.service.js";

export async function getByIsbn(req, res, next) {
  try {
    const isbn = req.query.isbn;

    if (!isbn) {
      return res.status(400).json({ error: "Bitte isbn als Query-Parameter angeben." });
    }

    const item = await fetchGoogleVolumeByIsbn(isbn);

    if (!item) {
      return res.status(404).json({ error: "Kein Buch zu dieser ISBN gefunden." });
    }

    const book = mapVolumeToBook(item, isbn);

    // Falls Google zwar ein Item liefert, aber wir nichts Sinnvolles mappen konnten
    if (!book || !book.title) {
      return res.status(404).json({ error: "Buchdaten unvollständig." });
    }

    return res.json({ ok: true, book });
  } catch (err) {
    next(err);
  }
}
