// ==============================
// Login Modal - Steuerung + Auth
// Datei: public/js/pages/index.js
// ==============================

const openBtn = document.getElementById("openLogin");
const closeBtn = document.getElementById("closeLogin");
const modal = document.getElementById("loginModal");
const form = document.getElementById("loginForm");
const registerBtn = document.getElementById("registerBtn");

// Modal öffnen
function openModal() {
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  // Fokus auf E-Mail/Username Feld
  const emailInput = document.getElementById("email");
  if (emailInput) emailInput.focus();
}

// Modal schließen
function closeModal() {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

// Button-Events
openBtn.addEventListener("click", openModal);
closeBtn.addEventListener("click", closeModal);

// Klick auf Overlay schließt
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ESC schließt
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("active")) closeModal();
});

// Gemeinsame Funktion für Login/Register
async function authCall(url) {
  // Du zeigst "E-Mail" im UI, wir benutzen es als "username" für die DB/Auth
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error ?? "Fehler.");
      return null;
    }

    return data;
  } catch (err) {
    alert("Server nicht erreichbar.");
    return null;
  }
}

// Registrieren (oben rechts)
registerBtn.addEventListener("click", async () => {
  const data = await authCall("/api/auth/register");
  if (data?.ok) window.location.href = "home.html";
});

// Login (Form submit)
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = await authCall("/api/auth/login");
  if (data?.ok) window.location.href = "home.html";
});
