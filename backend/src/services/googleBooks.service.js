// backend/src/services/googleBooks.service.js
// Hinweis: Node.js 18+ stellt fetch global zur Verfügung (kein extra Import nötig).

// ==================================================
// GOOGLE BOOKS SERVICE
// Zuständig für das Abrufen und Aufbereiten von Buchdaten aus der Google Books API
// ==================================================

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || null;

/**
 * Holt das erste passende Google-Books-Volume zu einer ISBN.
 *
 * Ablauf:
 * - ISBN bereinigen (nur Ziffern + X)
 * - Anfrage an Google Books API stellen
 * - Erstes Ergebnis (falls vorhanden) zurückgeben
 *
 * @param {string} isbn
 * @returns {Promise<object|null>} Rohes Volume-Item oder null
 */
export async function fetchGoogleVolumeByIsbn(isbn) {
  // --------------------------------------------------
  // ISBN bereinigen
  // --------------------------------------------------

  const clean = String(isbn || "").replace(/[^0-9Xx]/g, "").trim();
  if (!clean) return null;

  // --------------------------------------------------
  // Request-URL bauen
  // --------------------------------------------------
  // API-Key ist optional (wird nur angehängt, wenn vorhanden).

  const url =
    `${GOOGLE_BOOKS_BASE}?q=isbn:${encodeURIComponent(clean)}` +
    `&maxResults=1` +
    (GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}` : "");

  const res = await fetch(url);

  // --------------------------------------------------
  // Fehlerbehandlung
  // --------------------------------------------------
  // Statuscodes (z. B. 429) werden bewusst nach oben durchgereicht,
  // damit der Controller sinnvoll darauf reagieren kann.

  if (!res.ok) {
    const err = new Error(`Google Books API Fehler: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  // --------------------------------------------------
  // Antwort auswerten
  // --------------------------------------------------

  const data = await res.json().catch(() => ({}));
  const item = Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
  return item;
}

/**
 * Mappt ein Google-Books-Volume-Item auf das interne Backend-Format.
 *
 * Ziel:
 * - Einheitliches Datenformat für Frontend & Weiterverarbeitung
 * - Unabhängig davon, wie Google die Felder intern benennt
 *
 * @param {object} item - Rohes Volume-Item von Google Books
 * @param {string|null} fallbackIsbn - Fallback, falls keine ISBN gefunden wird
 * @returns {object|null} Gemapptes Buchobjekt oder null
 */
export function mapVolumeToBook(item, fallbackIsbn = null) {
  if (!item) return null;

  const info = item.volumeInfo ?? {};
  const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];

  // --------------------------------------------------
  // ISBN ermitteln
  // --------------------------------------------------
  // Bevorzugt ISBN_13, dann ISBN_10, sonst Fallback.

  const isbn13 =
    identifiers.find((x) => x.type === "ISBN_13")?.identifier ??
    identifiers.find((x) => x.type === "ISBN_10")?.identifier ??
    fallbackIsbn ??
    null;

  const title = info.title ?? null;

  // --------------------------------------------------
  // Autor:innen
  // --------------------------------------------------

  const authors = Array.isArray(info.authors) ? info.authors : [];
  const author = authors.length > 0 ? authors.join(", ") : null;

  // --------------------------------------------------
  // Kategorien / Genres
  // --------------------------------------------------
  // Google nennt diese "categories".

  const categories = Array.isArray(info.categories)
    ? info.categories.map((c) => String(c).trim()).filter(Boolean)
    : [];

  // --------------------------------------------------
  // Cover-Bild
  // --------------------------------------------------
  // Google liefert verschiedene Größen – wir nehmen bevorzugt thumbnail.

  const images = info.imageLinks ?? {};
  const coverUrl = images.thumbnail ?? images.smallThumbnail ?? null;

  // --------------------------------------------------
  // Veröffentlichungsjahr
  // --------------------------------------------------
  // publishedDate ist oft "YYYY" oder "YYYY-MM-DD".

  const publishedYear = info.publishedDate
    ? Number(String(info.publishedDate).slice(0, 4))
    : null;

  const safeYear = Number.isFinite(publishedYear) ? publishedYear : null;

  const description = info.description ?? null;

  // --------------------------------------------------
  // Einheitliches Rückgabeformat
  // --------------------------------------------------

  return {
    title,
    author,       // String (für UI-Anzeige)
    authors,      // Array (für authors-Tabelle)
    categories,   // Array (für genres)
    publishedYear: safeYear,
    isbn: isbn13,
    description,
    coverUrl,
  };
}