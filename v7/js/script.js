/* ============================================================
   Location St-Flo — v7 (professionnel · variante)
   ============================================================ */
(function () {
  "use strict";

  const burger = document.getElementById("burger");
  const menu = document.getElementById("menu");
  const toggle = (open) => {
    const isOpen = open ?? !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  };
  burger.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggle(false)));
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("is-open") && !menu.contains(e.target) && e.target !== burger) toggle(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });

  const seasons = document.querySelector(".seasons");
  if (seasons) {
    const buttons = seasons.querySelectorAll("button");
    const set = (s) => {
      buttons.forEach((b) => {
        const active = b.dataset.season === s;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".price-cards b[data-season]").forEach((el) => {
        el.hidden = el.dataset.season !== s;
      });
    };
    buttons.forEach((b) => b.addEventListener("click", () => set(b.dataset.season)));
    set("low");
  }

  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const d = new FormData(form);
      const subject = `Demande de réservation — ${d.get("activity")}`;
      const body =
        `Nom : ${d.get("name")}\n` +
        `Email : ${d.get("email")}\n` +
        `Téléphone : ${d.get("phone") || "—"}\n` +
        `Activité : ${d.get("activity")}\n\n` +
        `${d.get("message") || ""}`;
      const hint = document.getElementById("formHint");
      if (hint) hint.hidden = false;
      window.location.href =
        `mailto:Contact@location-stflo.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
