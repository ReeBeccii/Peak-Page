// src/services/googleBooks.service.js
// Node.js 18+ (du hast Node 22) hat fetch global -> KEIN node-fetch nötig.

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";

/**
 * Holt das erste passende Volume zu einer ISBN.
 * @param {string} isbn
 * @returns {Promise<object|null>} raw volume item oder null
 */
export async function fetchGoogleVolumeByIsbn(isbn) {
  const clean = String(isbn || "").replace(/[^0-9Xx]/g, "").trim();
  if (!clean) return null;

  const url = `${GOOGLE_BOOKS_BASE}?q=isbn:${encodeURIComponent(clean)}&maxResults=1`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Books API Fehler: ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  const item = Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
  return item;
}

/**
 * Mappt ein Google Books Volume Item auf dein Backend-Format.
 * @param {object} item
 * @param {string} fallbackIsbn
 */
export function mapVolumeToBook(item, fallbackIsbn = null) {
  if (!item) return null;

  const info = item.volumeInfo ?? {};
  const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];

  const isbn13 =
    identifiers.find((x) => x.type === "ISBN_13")?.identifier ??
    identifiers.find((x) => x.type === "ISBN_10")?.identifier ??
    fallbackIsbn ??
    null;

  const title = info.title ?? null;

  const authors = Array.isArray(info.authors) ? info.authors : [];
  const author = authors.length > 0 ? authors.join(", ") : null;

  // Google nennt es "categories"
  const categories = Array.isArray(info.categories)
    ? info.categories.map((c) => String(c).trim()).filter(Boolean)
    : [];

  // Cover (Google liefert verschiedene Größen)
  const images = info.imageLinks ?? {};
  const coverUrl = images.thumbnail ?? images.smallThumbnail ?? null;

  // publishedDate ist oft "YYYY" oder "YYYY-MM-DD"
  const publishedYear = info.publishedDate ? Number(String(info.publishedDate).slice(0, 4)) : null;
  const safeYear = Number.isFinite(publishedYear) ? publishedYear : null;

  const description = info.description ?? null;

  return {
    title,
    author,       // String (für dein UI)
    authors,      // Array (für authors Tabelle)
    categories,   // Array (für genres)
    publishedYear: safeYear,
    isbn: isbn13,
    description,
    coverUrl,
  };
}
