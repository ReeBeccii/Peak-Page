const toggleBtn = document.querySelector(".toggle-button");
const navContainer = document.querySelector(".nav-container");

if (toggleBtn && navContainer) {
  toggleBtn.addEventListener("click", () => {
    navContainer.classList.toggle("active");
  });
}
