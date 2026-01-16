// public/js/pages/addbook.js

const form = document.getElementById("addBookForm");
const hint = document.getElementById("formHint");

const isbnBtn = document.getElementById("isbnSearchBtn");
const coverPreview = document.getElementById("coverPreview");

const placeholderCover = "/assets/img/placeholders/cover-placeholder.png";

// ✅ Merker: zuletzt gefundenes Cover (wird beim Speichern mitgeschickt)
let lastCoverUrl = null;

// Hinweistext setzen
function setHint(text, isError = false) {
  if (!hint) return;
  hint.textContent = text;
  hint.style.opacity = "1";
  hint.style.color = "#fff";
}

// Login-Check
async function requireLogin() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) window.location.href = "index.html";
  } catch {
    window.location.href = "index.html";
  }
}

requireLogin();
showCover(null);

// Nur automatisch füllen, wenn Feld leer ist
function fillIfEmpty(inputId, value) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (!el.value.trim() && value) el.value = value;
}

// Cover anzeigen (mit Fallback)
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

// ✅ ISBN suchen → Google Books → Formular befüllen
isbnBtn?.addEventListener("click", async () => {
  const isbn = document.getElementById("isbn")?.value.trim();

  if (!isbn) {
    setHint("Bitte zuerst eine ISBN eingeben.", true);
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
      lastCoverUrl = null;
      showCover(null);
      return;
    }

    const book = data.book ?? {};

    fillIfEmpty("title", book.title);

    const authorText = Array.isArray(book.authors)
      ? book.authors.join(", ")
      : (book.author ?? "");

    fillIfEmpty("author", authorText);
    fillIfEmpty("year", book.publishedYear ? String(book.publishedYear) : "");
    fillIfEmpty("isbn", book.isbn);

    // ✅ Cover merken + anzeigen
    lastCoverUrl = book.coverUrl ?? null;
    showCover(lastCoverUrl);

    setHint("Buchdaten übernommen ✅ (du kannst alles noch ändern)");
  } catch {
    setHint("Fehler: Server nicht erreichbar.", true);
    lastCoverUrl = null;
    showCover(null);
  }
});

// ✅ Formular speichern (POST /api/books)
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // ✅ Status ist Pflicht (unread | finished)
  const statusEl = document.getElementById("status");
  const status = statusEl ? statusEl.value : null;

  // ✅ Rating optional (1..5 oder leer)
  const ratingEl = document.getElementById("rating");
  const ratingRaw = ratingEl ? ratingEl.value : "";
  const rating =
    ratingRaw !== null && String(ratingRaw).trim() !== ""
      ? Number(ratingRaw)
      : null;

  const payload = {
    title: document.getElementById("title")?.value.trim(),
    author: document.getElementById("author")?.value.trim(),
    isbn: document.getElementById("isbn")?.value.trim() || null,
    year: document.getElementById("year")?.value
      ? Number(document.getElementById("year").value)
      : null,
    price: document.getElementById("price")?.value
      ? Number(document.getElementById("price").value)
      : null,
    format: document.getElementById("format")?.value,
    notes: document.getElementById("notes")?.value.trim() || null,

    // ✅ NEU: Status + Rating + CoverUrl mitschicken
    status,
    rating,
    coverUrl: lastCoverUrl,
  };

  if (!payload.title || !payload.author) {
    setHint("Titel und Autor:in sind Pflichtfelder.", true);
    return;
  }

  if (!payload.status) {
    setHint("Bitte einen Status wählen (Pflichtfeld).", true);
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

    lastCoverUrl = null;
    showCover(null);
  } catch {
    setHint("Server nicht erreichbar.", true);
  }
});
