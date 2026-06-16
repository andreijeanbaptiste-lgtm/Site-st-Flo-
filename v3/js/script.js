/* ============================================================
   Location St-Flo — v3 (édition affiche) — interactions
   ============================================================ */
(function () {
  "use strict";

  /* Mobile menu */
  const burger = document.getElementById("burger");
  const links = document.getElementById("navLinks");
  const toggle = (open) => {
    const isOpen = open ?? !links.classList.contains("is-open");
    links.classList.toggle("is-open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
  };
  burger.addEventListener("click", () => toggle());
  links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggle(false)));

  /* Reveal on scroll */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* Season toggle */
  const season = document.querySelector(".season3");
  if (season) {
    const buttons = season.querySelectorAll("button");
    const set = (s) => {
      buttons.forEach((b) => {
        const active = b.dataset.season === s;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".tickets b[data-season]").forEach((el) => {
        el.hidden = el.dataset.season !== s;
      });
    };
    buttons.forEach((b) => b.addEventListener("click", () => set(b.dataset.season)));
    set("low");
  }

  /* Year */
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
