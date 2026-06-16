/* ============================================================
   Location St-Flo — Interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---- Sticky nav state ---- */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 30);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Mobile menu ---- */
  const burger = document.getElementById("burger");
  const navLinks = document.getElementById("navLinks");
  const toggleMenu = (open) => {
    const isOpen = open ?? !navLinks.classList.contains("is-open");
    navLinks.classList.toggle("is-open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
  };
  burger.addEventListener("click", () => toggleMenu());
  navLinks.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => toggleMenu(false))
  );

  /* ---- Scroll reveal ---- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---- Pricing season toggle ---- */
  const toggle = document.querySelector(".pricing__toggle");
  if (toggle) {
    const buttons = toggle.querySelectorAll("button");
    const setSeason = (season) => {
      buttons.forEach((b) => {
        const active = b.dataset.season === season;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll("[data-season]").forEach((el) => {
        if (el.tagName === "BUTTON") return;
        el.hidden = el.dataset.season !== season;
      });
    };
    buttons.forEach((b) =>
      b.addEventListener("click", () => setSeason(b.dataset.season))
    );
    setSeason("low");
  }

  /* ---- Contact form -> mailto ---- */
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const data = new FormData(form);
      const subject = `Demande de réservation — ${data.get("activity")}`;
      const body =
        `Nom : ${data.get("name")}\n` +
        `Email : ${data.get("email")}\n` +
        `Téléphone : ${data.get("phone") || "—"}\n` +
        `Activité : ${data.get("activity")}\n\n` +
        `${data.get("message") || ""}`;
      const hint = document.getElementById("formHint");
      if (hint) hint.hidden = false;
      window.location.href =
        `mailto:Contact@location-stflo.com?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;
    });
  }

  /* ---- Footer year ---- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
