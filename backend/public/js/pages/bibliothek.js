// public/js/pages/bibliothek.js

const listEl = document.getElementById("booksList");
const listHint = document.getElementById("listHint");

const filterYear = document.getElementById("filterYear");
const filterAuthor = document.getElementById("filterAuthor");
const filterFormat = document.getElementById("filterFormat");
const searchText = document.getElementById("searchText");
const resetBtn = document.getElementById("resetFilters");

const PLACEHOLDER_COVER = "/assets/img/placeholders/cover-placeholder.png";

let allBooks = [];      // komplette API-Liste
let filteredBooks = []; // nach Filter + Suche

function setHint(text) {
  if (!listHint) return;
  listHint.textContent = text;
  listHint.style.opacity = "1";
  listHint.style.color = "#fff";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function coverUrlOrPlaceholder(url) {
  if (!url) return PLACEHOLDER_COVER;
  return String(url).replace(/^http:\/\//, "https://");
}

function safeFormatLabel(v) {
  return typeof window.formatLabel === "function"
    ? window.formatLabel(v)
    : String(v ?? "");
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

// API laden
async function loadLibrary() {
  setHint("Lade Bücher…");
  const res = await fetch("/api/library?status=finished", { credentials: "include" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    setHint(data.error ?? "Fehler beim Laden.");
    allBooks = [];
    applyFilters();
    return;
  }

  allBooks = data.books ?? [];
  buildFilterOptions(allBooks);
  applyFilters();
}

function uniqSorted(arr) {
  return [...new Set(arr)].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "de"));
}

function buildFilterOptions(books) {
  // Jahre
  const years = uniqSorted(
    books.map((b) => b.finishedYear).filter((y) => Number.isInteger(y))
  ).sort((a, b) => b - a);

  // Autoren
  const authors = uniqSorted(
    books.flatMap((b) => (Array.isArray(b.authors) ? b.authors : []))
  );

  // Formate (DB-Werte als value, Anzeige deutsch)
  const formats = uniqSorted(books.map((b) => b.format));

  function fillSelect(select, values, allLabel = "Alle") {
    if (!select) return;
    select.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = allLabel;
    select.appendChild(optAll);

    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = String(v);

      // Format-Select: deutsch anzeigen
      if (select === filterFormat) {
        opt.textContent = safeFormatLabel(v);
      } else {
        opt.textContent = String(v);
      }

      select.appendChild(opt);
    }
  }

  fillSelect(filterYear, years, "Alle");
  fillSelect(filterAuthor, authors, "Alle");
  fillSelect(filterFormat, formats, "Alle");
}

function applyFilters() {
  const y = filterYear?.value || "";
  const a = filterAuthor?.value || "";
  const f = filterFormat?.value || "";
  const q = (searchText?.value || "").trim().toLowerCase();

  filteredBooks = allBooks.filter((b) => {
    if (y && String(b.finishedYear) !== String(y)) return false;

    if (a) {
      const authors = Array.isArray(b.authors) ? b.authors : [];
      if (!authors.includes(a)) return false;
    }

    if (f && String(b.format) !== String(f)) return false;

    if (q) {
      const title = b.book?.title ?? "";
      const authors = (Array.isArray(b.authors) ? b.authors.join(" ") : "");
      const hay = `${title} ${authors}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  renderList(filteredBooks);
}

function stars(n) {
  const x = Number(n);
  if (!Number.isInteger(x) || x < 1) return "—";
  return "★".repeat(x) + "☆".repeat(5 - x);
}

function renderList(books) {
  if (!listEl) return;

  if (!books.length) {
    listEl.innerHTML = "";
    setHint("Keine Bücher für diese Filter gefunden.");
    return;
  }

  setHint(`${books.length} Buch/Bücher angezeigt.`);

  listEl.innerHTML = books.map((b) => {
    const title = b.book?.title || "(ohne Titel)";
    const author = (Array.isArray(b.authors) && b.authors[0]) ? b.authors[0] : "—";
    const formatUi = b.format ? safeFormatLabel(b.format) : "—";
    const year = b.finishedYear || "—";

    const cover = coverUrlOrPlaceholder(b.book?.coverUrl);

    const ratingText = stars(b.rating);
    const priceText =
      (b.pricePaid === null || b.pricePaid === undefined || b.pricePaid === "")
        ? "—"
        : `${Number(b.pricePaid).toFixed(2)} €`;

    const notes = b.notes || "—";

    return `
      <article class="book-card" data-userbookid="${b.userBookId}">
        <div class="book-head" role="button" tabindex="0" aria-expanded="false">
          <img class="book-cover" src="${esc(cover)}" alt="Cover ${esc(title)}"
               onerror="this.src='${esc(PLACEHOLDER_COVER)}'">

          <div class="book-main">
            <div class="book-title">${esc(title)}</div>
            <div class="book-author">${esc(author)}</div>
            <div class="book-meta">${esc(formatUi)} · Lesejahr ${esc(year)}</div>
          </div>

          <div class="book-side">
            <div class="pill">Bewertung: ${esc(ratingText)}</div>
            <div class="pill">Preis: ${esc(priceText)}</div>
            <div class="pill pill-details">Details ▾</div>
          </div>
        </div>

        <div class="book-details" hidden>
          <div class="details-grid">
            <div>
              <div class="details-label">Notizen</div>
              <div class="details-text">${esc(notes)}</div>
            </div>

            <div class="details-actions">
              <button class="btn-secondary js-edit" type="button">Bearbeiten</button>
              <button class="btn-danger js-delete" type="button">Löschen</button>
            </div>

            <form class="edit-form" hidden>
              <div class="detail-row">
                <div class="k">Lesejahr</div>
                <div class="v">
                  <input class="edit-year" type="number" min="1000" max="9999" value="${esc(year)}" />
                </div>
              </div>

              <div class="detail-row">
                <div class="k">Format</div>
                <div class="v">
                  <select class="edit-format">
                    <option value="paperback" ${b.format === "paperback" ? "selected" : ""}>Taschenbuch</option>
                    <option value="hardcover" ${b.format === "hardcover" ? "selected" : ""}>Hardcover</option>
                    <option value="ebook" ${b.format === "ebook" ? "selected" : ""}>E-Book</option>
                    <option value="audiobook" ${b.format === "audiobook" ? "selected" : ""}>Hörbuch</option>
                  </select>
                </div>
              </div>

              <div class="detail-row">
                <div class="k">Bewertung (1–5)</div>
                <div class="v">
                  <select class="edit-rating">
                    <option value="">(keine)</option>
                    ${[1,2,3,4,5].map(n =>
                      `<option value="${n}" ${b.rating === n ? "selected" : ""}>${n}</option>`
                    ).join("")}
                  </select>
                </div>
              </div>

              <div class="detail-row">
                <div class="k">Preis (€)</div>
                <div class="v">
                  <input class="edit-price" type="number" step="0.01" min="0"
                         value="${b.pricePaid ?? ""}" placeholder="optional" />
                </div>
              </div>

              <div class="detail-row">
                <div class="k">Notizen</div>
                <div class="v">
                  <textarea class="edit-notes" rows="3" placeholder="optional">${esc(b.notes ?? "")}</textarea>
                </div>
              </div>

              <div class="details-actions">
                <button class="btn-secondary js-cancel" type="button">Abbrechen</button>
                <button class="btn-primary js-save" type="submit">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      </article>
    `;
  }).join("");

  wireCardEvents();
}

function wireCardEvents() {
  const cards = listEl.querySelectorAll(".book-card");

  cards.forEach((card) => {
    const head = card.querySelector(".book-head");
    const details = card.querySelector(".book-details");

    function toggle() {
      const isOpen = !details.hasAttribute("hidden");
      if (isOpen) {
        details.setAttribute("hidden", "");
        card.classList.remove("open");
        head.setAttribute("aria-expanded", "false");
      } else {
        details.removeAttribute("hidden");
        card.classList.add("open");
        head.setAttribute("aria-expanded", "true");
      }
    }

    head?.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      toggle();
    });

    head?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    const editBtn = card.querySelector(".js-edit");
    const delBtn = card.querySelector(".js-delete");

    const editForm = card.querySelector(".edit-form");
    const cancelBtn = card.querySelector(".js-cancel");

    editBtn?.addEventListener("click", () => {
      editForm?.removeAttribute("hidden");
      // optional: beim Bearbeiten gleich aufklappen
      details?.removeAttribute("hidden");
      card.classList.add("open");
      head?.setAttribute("aria-expanded", "true");
    });

    cancelBtn?.addEventListener("click", () => {
      editForm?.setAttribute("hidden", "");
    });

    // Löschen
    delBtn?.addEventListener("click", async () => {
      const userBookId = card.dataset.userbookid;
      if (!userBookId) return;

      const ok = confirm("Willst du diesen Eintrag wirklich löschen?");
      if (!ok) return;

      const res = await fetch(`/api/library/${encodeURIComponent(userBookId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Fehler beim Löschen.");
        return;
      }

      allBooks = allBooks.filter((b) => String(b.userBookId) !== String(userBookId));
      applyFilters();
    });

    // Speichern (PATCH)
    editForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const userBookId = card.dataset.userbookid;
      if (!userBookId) return;

      const year = card.querySelector(".edit-year")?.value;
      const format = card.querySelector(".edit-format")?.value;
      const rating = card.querySelector(".edit-rating")?.value;
      const pricePaid = card.querySelector(".edit-price")?.value;
      const notes = card.querySelector(".edit-notes")?.value;

      const payload = {
        finishedYear: year,
        format,
        rating: rating === "" ? null : Number(rating),
        pricePaid: pricePaid === "" ? null : Number(pricePaid),
        notes: notes?.trim() || null,
      };

      const res = await fetch(`/api/library/${encodeURIComponent(userBookId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Fehler beim Speichern.");
        return;
      }

      // neu laden, damit alles konsistent ist (Filterlisten, Anzeige, etc.)
      await loadLibrary();
    });
  });
}

// Filter Events
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

// Start
(async function init() {
  await requireLogin();
  await loadLibrary();
})();