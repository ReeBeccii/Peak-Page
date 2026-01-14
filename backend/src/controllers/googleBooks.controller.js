// backend/src/controllers/googleBooks.controller.js
import { searchVolumes, getVolume } from "../services/googleBooks.service.js";

export async function searchGoogleBooks(req, res) {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: "Query-Parameter 'q' fehlt" });

  const max = req.query.max ?? 10;

  const data = await searchVolumes({ q, maxResults: max });

  // schlankes Response-Format fürs Frontend
  const items = (data.items || []).map((v) => ({
    google_id: v.id,
    title: v.volumeInfo?.title ?? null,
    authors: v.volumeInfo?.authors ?? [],
    publishedDate: v.volumeInfo?.publishedDate ?? null,
    isbn13: (v.volumeInfo?.industryIdentifiers || []).find((x) => x.type === "ISBN_13")?.identifier ?? null,
    cover_url: v.volumeInfo?.imageLinks?.thumbnail ?? null,
  }));

  res.json({ totalItems: data.totalItems ?? 0, items });
}

export async function getGoogleBookById(req, res) {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "Google Volume ID fehlt" });

  const volume = await getVolume(id);
  res.json(volume);
}
