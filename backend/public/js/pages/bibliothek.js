// public/js/pages/bibliothek.js

const listEl = document.getElementById("booksList");
const hintEl = document.getElementById("listHint");

const filterYear = document.getElementById("filterYear");
const filterAuthor = document.getElementById("filterAuthor");
const filterFormat = document.getElementById("filterFormat");
const searchText = document.getElementById("searchText");
const resetBtn = document.getElementById("resetFilters");

const placeholderCover = "/assets/img/placeholders/cover-placeholder.png";

// In-Memory Daten
let allItems = [];      // komplette API Antwort (gefiltert: status finished)
let filteredItems = []; // nach UI Filter

function setHint(text) {
  if (!hintEl) return;
  hintEl.textContent = text || "";
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

function moneyEUR(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(2).replace(".", ",")} €`;
}

function stars(n) {
  const val = Number(n);
  if (!Number.isFinite(val) || val <= 0) return "—";
  const full = "★".repeat(Math.max(0, Math.min(5, val)));
  const empty = "☆".repeat(Math.max(0, 5 - Math.min(5, val)));
  return full + empty;
}

async function requireLogin() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) window.location.href = "index.html";
}

async function fetchLibraryFinished() {
  const res = await fetch("/api/library?status=finished", { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Fehler beim Laden.");
  return data.books || [];
}

function buildFilters(items) {
  // Year (finishedYear)
  const years = [...new Set(items.map(x => x.finishedYear).filter(Boolean))].sort((a,b)=>b-a);

  // Authors
  const authors = [...new Set(items.flatMap(x => x.authors || []).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));

  // Formats
  const formats = [...new Set(items.map(x => x.format).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));

  // helper to fill select
  function fillSelect(sel, values, labelAll="Alle") {
    if (!sel) return;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = labelAll;
    sel.appendChild(optAll);

    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      sel.appendChild(opt);
    }
  }

  fillSelect(filterYear, years, "Alle");
  fillSelect(filterAuthor, authors, "Alle");
  fillSelect(filterFormat, formats, "Alle");
}

function applyFilters() {
  const yearVal = filterYear?.value || "";
  const authorVal = filterAuthor?.value || "";
  const formatVal = filterFormat?.value || "";
  const q = (searchText?.value || "").trim().toLowerCase();

  filteredItems = allItems.filter(item => {
    if (yearVal && String(item.finishedYear || "") !== yearVal) return false;
    if (formatVal && String(item.format || "") !== formatVal) return false;

    if (authorVal) {
      const a = item.authors || [];
      if (!a.includes(authorVal)) return false;
    }

    if (q) {
      const title = item.book?.title || "";
      const authorJoined = (item.authors || []).join(", ");
      const hay = `${title} ${authorJoined}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  renderList(filteredItems);
}

function renderList(items) {
  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = "";
    setHint("Keine Bücher für diese Filter gefunden.");
    return;
  }

  setHint(`${items.length} Buch/Bücher angezeigt.`);

  listEl.innerHTML = items.map((item) => {
    const coverUrl = item.book?.coverUrl || null;
    const safeCover = coverUrl ? String(coverUrl).replace(/^http:\/\//, "https://") : placeholderCover;

    const title = item.book?.title || "(ohne Titel)";
    const authorLine = (item.authors && item.authors.length) ? item.authors.join(", ") : "—";
    const meta = `${item.format || "—"} · Lesejahr ${item.finishedYear || "—"}`;

    const ratingLine = `Bewertung: ${stars(item.rating)}`;
    const priceLine = `Preis: ${moneyEUR(item.pricePaid)}`;
    const notes = item.notes ? esc(item.notes) : "—";

    // Details sind initial hidden (via hidden attribute)
    return `
      <article class="book-card" data-userbookid="${item.userBookId}">
        <button class="book-head" type="button" data-action="toggle" aria-expanded="false">
          <img class="book-cover" src="${esc(safeCover)}" alt="Cover: ${esc(title)}"
               onerror="this.src='${placeholderCover}'" />

          <div class="book-main">
            <div class="book-title">${esc(title)}</div>
            <div class="book-author">${esc(authorLine)}</div>
            <div class="book-meta">${esc(meta)}</div>
          </div>

          <div class="book-side">
            <span class="pill">${esc(ratingLine)}</span>
            <span class="pill">${esc(priceLine)}</span>
            <span class="pill pill-open">Details ▾</span>
          </div>
        </button>

        <div class="book-details" hidden>
          <div class="details-grid">
            <div>
              <div class="details-label">Notizen</div>
              <div class="details-text">${notes}</div>
            </div>

            <div class="details-actions">
              <button class="btn-primary" type="button" data-action="edit">Bearbeiten</button>
              <button class="btn-danger" type="button" data-action="delete">Löschen</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* =========================
   Events
   ========================= */

function wireFilterEvents() {
  filterYear?.addEventListener("change", applyFilters);
  filterAuthor?.addEventListener("change", applyFilters);
  filterFormat?.addEventListener("change", applyFilters);
  searchText?.addEventListener("input", applyFilters);

  resetBtn?.addEventListener("click", () => {
    if (filterYear) filterYear.value = "";
    if (filterAuthor) filterAuthor.value = "";
    if (filterFormat) filterFormat.value = "";
    if (searchText) searchText.value = "";
    applyFilters();
  });
}

// ✅ Event Delegation: klappt auch nach Re-Render
listEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const card = btn.closest(".book-card");
  if (!card) return;

  const userBookId = card.getAttribute("data-userbookid");

  if (action === "toggle") {
    const details = card.querySelector(".book-details");
    const headBtn = card.querySelector(".book-head");

    if (!details || !headBtn) return;

    const isHidden = details.hasAttribute("hidden");
    if (isHidden) {
      details.removeAttribute("hidden");
      headBtn.setAttribute("aria-expanded", "true");
      const openPill = card.querySelector(".pill-open");
      if (openPill) openPill.textContent = "Details ▴";
    } else {
      details.setAttribute("hidden", "");
      headBtn.setAttribute("aria-expanded", "false");
      const openPill = card.querySelector(".pill-open");
      if (openPill) openPill.textContent = "Details ▾";
    }
    return;
  }

  if (action === "delete") {
    // Noch keine Route? Dann erstmal nur UX: bestätigen
    const ok = confirm("Willst du dieses Buch wirklich löschen?");
    if (!ok) return;

    // Wenn du schon eine DELETE Route hast, sag Bescheid:
    // await fetch(`/api/user-books/${userBookId}`, { method: "DELETE", credentials: "include" })

    alert("Delete ist als nächstes dran (Route fehlt noch). Sag Bescheid, dann bauen wir sie.");
    return;
  }

  if (action === "edit") {
    alert("Edit ist als nächstes dran (Modal/Form + Route). Sag Bescheid, dann bauen wir’s.");
    return;
  }
});

async function init() {
  await requireLogin();

  try {
    allItems = await fetchLibraryFinished();
    buildFilters(allItems);
    wireFilterEvents();
    applyFilters();
  } catch (err) {
    console.error(err);
    setHint("Fehler beim Laden der Bibliothek.");
  }
}

init();
