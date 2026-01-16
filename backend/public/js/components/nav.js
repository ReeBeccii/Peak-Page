// Burger Menü
const toggleButton = document.querySelector(".toggle-button");
const navContainer = document.querySelector(".nav-container");

toggleButton?.addEventListener("click", () => {
  navContainer.classList.toggle("active");
});

// Logout
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn?.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    if (res.ok) {
      window.location.href = "index.html";
    } else {
      alert("Logout fehlgeschlagen.");
    }
  } catch (err) {
    alert("Server nicht erreichbar.");
  }
});
