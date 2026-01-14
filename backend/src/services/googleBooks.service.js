// backend/src/services/googleBooks.service.js
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://www.googleapis.com/books/v1";

/**
 * Baut eine Google Books URL zusammen, optional mit API Key.
 */
function buildUrl(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  // API Key optional (geht oft auch ohne, aber ist sauberer)
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  return url.toString();
}

/**
 * Google Books Suche: /volumes?q=...
 */
export async function searchVolumes({ q, maxResults = 10, startIndex = 0, lang = "de" }) {
  const url = buildUrl("/volumes", {
    q,
    maxResults: Math.min(Number(maxResults) || 10, 40),
    startIndex: Number(startIndex) || 0,
    langRestrict: lang,
    printType: "books",
  });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Books Fehler (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Google Books Details: /volumes/:id
 */
export async function getVolume(volumeId) {
  const url = buildUrl(`/volumes/${encodeURIComponent(volumeId)}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Books Fehler (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Mapping: Google Volume -> dein SQLite books Schema
 * books: (isbn13, title, cover_url, default_price)
 */
export function mapVolumeToBookRow(volume) {
  const vi = volume?.volumeInfo || {};
  const sale = volume?.saleInfo || {};

  const ids = vi.industryIdentifiers || [];
  const isbn13 = ids.find((x) => x.type === "ISBN_13")?.identifier ?? null;

  const cover_url =
    vi.imageLinks?.thumbnail ||
    vi.imageLinks?.smallThumbnail ||
    null;

  const default_price =
    sale.listPrice?.amount ??
    sale.retailPrice?.amount ??
    null;

  return {
    isbn13,
    title: vi.title || "(ohne Titel)",
    cover_url,
    default_price,
  };
}
