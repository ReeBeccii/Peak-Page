// public/js/pages/addbook.js

const form = document.getElementById("addBookForm");
const hint = document.getElementById("formHint");

const isbnBtn = document.getElementById("isbnSearchBtn");
const coverPreview = document.getElementById("coverPreview");

const placeholderCover = "/assets/img/placeholders/cover-placeholder.png";

// Wir merken uns das aktuelle Cover (damit es beim Speichern mitkommt)
let currentCoverUrl = null;

// Neu: Wir merken uns Autoren & Genres aus Google Books
let currentAuthors = [];
let currentGenres = [];

// Kleiner Helfer: Hinweistext setzen
function setHint(text, isError = false) {
  if (!hint) return;
  hint.textContent = text;
  hint.style.opacity = "1";
  hint.style.color = "#fff";
}

// Prüfen ob eingeloggt – sonst zurück zur Startseite
async function requireLogin() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) {
      window.location.href = "index.html";
    }
  } catch {
    window.location.href = "index.html";
  }
}

requireLogin();

// Nur automatisch füllen, wenn Feld leer ist (damit du manuell überschreiben kannst)
function fillIfEmpty(inputId, value) {
  const el = document.getElementById(inputId);
  if (!el) return;

  if (!el.value.trim() && value) {
    el.value = value;
  }
}

// Cover anzeigen (oder Placeholder)
function showCover(url) {
  if (!coverPreview) return;

  const finalUrl = url
    ? String(url).replace(/^http:\/\//, "https://")
    : placeholderCover;

  coverPreview.onerror = () => {
    coverPreview.src = placeholderCover;
  };

  coverPreview.src = finalUrl;
}

// Initial: Placeholder anzeigen
showCover(null);

// ✅ ISBN suchen → Google Books → Formular befüllen
isbnBtn?.addEventListener("click", async () => {
  const isbn = document.getElementById("isbn")?.value.trim();

  if (!isbn) {
    setHint("Bitte zuerst eine ISBN eingeben.", true);
    currentCoverUrl = null;
    currentAuthors = [];
    currentGenres = [];
    showCover(null);
    return;
  }

  setHint("Suche Buchdaten über Google Books…");

  try {
    const res = await fetch(`/api/google-books?isbn=${encodeURIComponent(isbn)}`, {
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setHint(data.error ?? "Keine Buchdaten gefunden.", true);
      currentCoverUrl = null;
      currentAuthors = [];
      currentGenres = [];
      showCover(null);
      return;
    }

    const book = data.book ?? {};

    // --- Felder befüllen ---
    fillIfEmpty("title", book.title);

    const authorText = Array.isArray(book.authors)
      ? book.authors.join(", ")
      : (book.author ?? "");

    fillIfEmpty("author", authorText);

    fillIfEmpty("year", book.publishedYear ? String(book.publishedYear) : "");
    fillIfEmpty("isbn", book.isbn);

    // --- Neu: Autoren & Genres merken (für DB) ---
    // Google liefert Genres häufig als "categories"
    currentAuthors = Array.isArray(book.authors) ? book.authors : [];
    currentGenres = Array.isArray(book.categories) ? book.categories : [];

    // --- Cover merken + anzeigen ---
    currentCoverUrl = book.coverUrl ?? null;
    showCover(currentCoverUrl);

    if (!currentCoverUrl) {
      setHint("Buchdaten übernommen ✅ (kein Cover verfügbar – Platzhalter wird angezeigt)");
    } else {
      setHint("Buchdaten übernommen ✅ (du kannst alles noch ändern)");
    }
  } catch {
    setHint("Fehler: Server nicht erreichbar.", true);
    currentCoverUrl = null;
    currentAuthors = [];
    currentGenres = [];
    showCover(null);
  }
});

// ✅ Formular speichern (POST /api/books)
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    title: document.getElementById("title")?.value.trim(),
    author: document.getElementById("author")?.value.trim(), // bleibt fürs UI, DB kann es später normalisieren
    isbn: document.getElementById("isbn")?.value.trim() || null,
    year: document.getElementById("year")?.value
      ? Number(document.getElementById("year").value)
      : null,
    price: document.getElementById("price")?.value
      ? Number(document.getElementById("price").value)
      : null,
    format: document.getElementById("format")?.value,
    notes: document.getElementById("notes")?.value.trim() || null,

    // ✅ fürs Cover + spätere Anzeige
    coverUrl: currentCoverUrl,

    // ✅ neu: normalisierte Daten (Autoren/Genres) fürs Backend
    authors: currentAuthors,
    genres: currentGenres,
  };

  if (!payload.title || !payload.author) {
    setHint("Titel und Autor:in sind Pflichtfelder.", true);
    return;
  }

  setHint("Speichere…");

  try {
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setHint(data.error ?? "Fehler beim Speichern.", true);
      return;
    }

    setHint("Gespeichert ✅");
    form.reset();

    // Reset Cover + Meta
    currentCoverUrl = null;
    currentAuthors = [];
    currentGenres = [];
    showCover(null);
  } catch {
    setHint("Server nicht erreichbar.", true);
  }
});
