// public/js/pages/sub.js

const booksList = document.getElementById("booksList");
const listHint = document.getElementById("listHint");

const filterAuthor = document.getElementById("filterAuthor");
const filterFormat = document.getElementById("filterFormat");
const searchText = document.getElementById("searchText");
const resetBtn = document.getElementById("resetFilters");

const placeholderCover = "/assets/img/placeholders/cover-placeholder.png";

// --- Helpers ---
function setHint(text = "") {
  if (!listHint) return;
  listHint.textContent = text;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toStars(n) {
  const v = Number(n);
  if (!v) return "—";
  return "★".repeat(v) + "☆".repeat(5 - v);
}

function euro(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(2).replace(".", ",") + " €";
}

function safeCover(url) {
  if (!url) return placeholderCover;
  return String(url).replace(/^http:\/\//, "https://");
}

async function requireLogin() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) window.location.href = "index.html";
  } catch {
    window.location.href = "index.html";
  }
}

requireLogin();

// --- Data ---
let allBooks = [];      // rohe API-Daten
let filtered = [];      // nach Filtern

async function fetchSub() {
  setHint("Lade SuB…");
  const res = await fetch("/api/library?status=unread", { credentials: "include" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    setHint(data.error ?? "Fehler beim Laden.");
    allBooks = [];
    filtered = [];
    render();
    return;
  }

  allBooks = Array.isArray(data.books) ? data.books : [];
  buildFilters(allBooks);
  applyFilters();
}

function buildFilters(items) {
  const authors = new Set();
  const formats = new Set();

  for (const it of items) {
    const a = Array.isArray(it.authors) ? it.authors : [];
    a.forEach(x => x && authors.add(String(x)));

    if (it.format) formats.add(String(it.format));
  }

  fillSelect(filterAuthor, ["Alle", ...Array.from(authors).sort((a,b)=>a.localeCompare(b))]);
  fillSelect(filterFormat, ["Alle", ...Array.from(formats).sort((a,b)=>a.localeCompare(b))]);
}

function fillSelect(sel, values) {
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = "";
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v === "Alle" ? "" : v;
    opt.textContent = v;
    sel.appendChild(opt);
  }
  // restore if possible
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

function applyFilters() {
  const a = filterAuthor?.value ?? "";
  const f = filterFormat?.value ?? "";
  const q = (searchText?.value ?? "").trim().toLowerCase();

  filtered = allBooks.filter(it => {
    const title = it.book?.title ?? "";
    const authors = Array.isArray(it.authors) ? it.authors.join(", ") : "";
    const hay = (title + " " + authors).toLowerCase();

    if (a) {
      const arr = Array.isArray(it.authors) ? it.authors : [];
      if (!arr.some(x => String(x) === a)) return false;
    }
    if (f && String(it.format) !== f) return false;
    if (q && !hay.includes(q)) return false;
    return true;
  });

  render();
}

function render() {
  if (!booksList) return;

  setHint(`${filtered.length} Buch/Bücher angezeigt.`);

  if (!filtered.length) {
    booksList.innerHTML = `<div class="card">Keine Bücher für diese Filter gefunden.</div>`;
    return;
  }

  booksList.innerHTML = filtered.map(renderCard).join("");
  wireCardEvents();
}

function renderCard(it) {
  const title = it.book?.title ?? "(ohne Titel)";
  const author = Array.isArray(it.authors) && it.authors.length ? it.authors[0] : "—";
  const meta = `${it.format ?? "—"}`;
  const rating = toStars(it.rating);
  const price = euro(it.pricePaid);

  const coverUrl = safeCover(it.book?.coverUrl);

  const notes = it.notes ? escapeHtml(it.notes) : "—";

  // Status für SuB editierbar (unread/finished)
  const statusVal = it.status ?? "unread";

  return `
    <article class="book-card" data-ubid="${it.userBookId}">
      <button class="book-head" type="button" aria-expanded="false">
        <img class="book-cover" src="${escapeHtml(coverUrl)}" alt="Cover" onerror="this.src='${placeholderCover}'" />
        <div class="book-main">
          <div class="book-title">${escapeHtml(title)}</div>
          <div class="book-author">${escapeHtml(author)}</div>
          <div class="book-meta">${escapeHtml(meta)}</div>
        </div>
        <div class="book-side">
          <div class="pill">Bewertung: ${escapeHtml(rating)}</div>
          <div class="pill">Preis: ${escapeHtml(price)}</div>
          <div class="pill">Details ▾</div>
        </div>
      </button>

      <div class="book-details">
        <div>
          <div class="details-label">Notizen</div>
          <div class="details-text">${notes}</div>
        </div>

        <div class="details-actions">
          <button class="btn-secondary btn-edit" type="button">Bearbeiten</button>
          <button class="btn-danger btn-delete" type="button">Löschen</button>
        </div>

        <form class="edit-form" hidden>
          <div class="detail-row">
            <div class="k">Status</div>
            <div class="v">
              <select name="status" required>
                <option value="unread" ${statusVal === "unread" ? "selected" : ""}>Ungelesen (SuB)</option>
                <option value="finished" ${statusVal === "finished" ? "selected" : ""}>Gelesen (Bibliothek)</option>
              </select>
            </div>
          </div>

          <div class="detail-row">
            <div class="k">Format</div>
            <div class="v">
              <select name="format">
                <option value="paperback" ${it.format === "paperback" ? "selected" : ""}>Taschenbuch</option>
                <option value="hardcover" ${it.format === "hardcover" ? "selected" : ""}>Hardcover</option>
                <option value="ebook" ${it.format === "ebook" ? "selected" : ""}>eBook</option>
                <option value="audio" ${it.format === "audio" ? "selected" : ""}>Hörbuch</option>
              </select>
            </div>
          </div>

          <div class="detail-row">
            <div class="k">Bewertung (1–5)</div>
            <div class="v">
              <select name="rating">
                <option value="">—</option>
                ${[1,2,3,4,5].map(n => `<option value="${n}" ${Number(it.rating)===n?"selected":""}>${n}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="detail-row">
            <div class="k">Preis (€)</div>
            <div class="v">
              <input name="pricePaid" type="number" step="0.01" min="0" value="${it.pricePaid ?? ""}" />
            </div>
          </div>

          <div class="detail-row">
            <div class="k">Notizen</div>
            <div class="v">
              <textarea name="notes" rows="4">${escapeHtml(it.notes ?? "")}</textarea>
            </div>
          </div>

          <div class="details-actions">
            <button class="btn-secondary btn-cancel" type="button">Abbrechen</button>
            <button class="btn-primary btn-save" type="submit">Speichern</button>
          </div>
        </form>
      </div>
    </article>
  `;
}

function wireCardEvents() {
  document.querySelectorAll(".book-card").forEach(card => {
    const head = card.querySelector(".book-head");
    const details = card.querySelector(".book-details");
    const editBtn = card.querySelector(".btn-edit");
    const delBtn = card.querySelector(".btn-delete");
    const form = card.querySelector(".edit-form");
    const cancelBtn = card.querySelector(".btn-cancel");

    head?.addEventListener("click", () => {
      const open = card.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });

    editBtn?.addEventListener("click", () => {
      form.hidden = false;
      // bei Bearbeiten automatisch aufklappen
      card.classList.add("open");
      head.setAttribute("aria-expanded", "true");
    });

    cancelBtn?.addEventListener("click", () => {
      form.hidden = true;
    });

    delBtn?.addEventListener("click", async () => {
      const ubid = card.dataset.ubid;
      if (!ubid) return;

      const ok = confirm("Wirklich löschen? (Das Buch bleibt als Stammdaten erhalten.)");
      if (!ok) return;

      const res = await fetch(`/api/user-books/${encodeURIComponent(ubid)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Fehler beim Löschen.");
        return;
      }

      // aus UI entfernen
      allBooks = allBooks.filter(x => String(x.userBookId) !== String(ubid));
      applyFilters();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ubid = card.dataset.ubid;
      if (!ubid) return;

      const fd = new FormData(form);

      const payload = {
        status: fd.get("status"),
        format: fd.get("format"),
        rating: fd.get("rating") ? Number(fd.get("rating")) : null,
        pricePaid: fd.get("pricePaid") ? Number(fd.get("pricePaid")) : null,
        notes: String(fd.get("notes") ?? "").trim() || null,
      };

      const res = await fetch(`/api/user-books/${encodeURIComponent(ubid)}`, {
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

      // danach neu laden: wenn status=finished -> verschwindet aus SuB automatisch
      await fetchSub();
    });
  });
}

// --- Events ---
filterAuthor?.addEventListener("change", applyFilters);
filterFormat?.addEventListener("change", applyFilters);
searchText?.addEventListener("input", applyFilters);

resetBtn?.addEventListener("click", () => {
  if (filterAuthor) filterAuthor.value = "";
  if (filterFormat) filterFormat.value = "";
  if (searchText) searchText.value = "";
  applyFilters();
});

fetchSub();
