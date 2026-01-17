// public/js/pages/home.js

const PLACEHOLDER_COVER = "assets/img/placeholders/cover-placeholder.png";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setImg(id, src) {
  const el = document.getElementById(id);
  if (!el) return;
  el.src = src || PLACEHOLDER_COVER;
  el.onerror = () => (el.src = PLACEHOLDER_COVER);
}

async function loadDashboard() {
  // Standard-Fallbacks setzen (falls gleich ein Fehler kommt)
  setText("statTotal", "–");
  setText("statYearRead", "–");
  setText("statSpend", "–");
  setText("statLoans", "–");

  // "Zuletzt gelesen" (neue Elemente)
  setText("lastReadTitle", "–");
  setText("lastReadAuthor", "");
  setImg("lastReadCover", PLACEHOLDER_COVER);

  try {
    const res = await fetch("/api/dashboard", { credentials: "include" });
    const data = await res.json().catch(() => ({}));

    // ✅ Nur dann "ausloggen" / umleiten, wenn wirklich nicht eingeloggt
    if (res.status === 401 || res.status === 403) {
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) {
      // Kein Redirect bei 500 etc. -> nur Werte bleiben bei "–"
      console.warn("Dashboard API Fehler:", data);
      return;
    }

    setText("statTotal", String(data.total ?? "–"));
    setText("statYearRead", String(data.yearRead ?? "–"));

    // € sauber formatieren
    const spend = Number(data.spendTotal ?? 0);
    setText(
      "statSpend",
      spend.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
    );

    setText("statLoans", String(data.loansOpen ?? 0));

    // Zuletzt gelesen (Objekt)
    if (data.lastRead) {
      setText("lastReadTitle", data.lastRead.title ?? "–");
      setText("lastReadAuthor", data.lastRead.author ?? "");

      // cover_url kann http sein -> für Mixed Content auf https drehen
      const coverUrl = data.lastRead.cover_url
        ? String(data.lastRead.cover_url).replace(/^http:\/\//, "https://")
        : null;

      setImg("lastReadCover", coverUrl);
    }
  } catch (e) {
    console.warn("Dashboard nicht erreichbar:", e);
    // Werte bleiben auf "–"
  }
}

loadDashboard();
