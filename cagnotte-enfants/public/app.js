// Petites interactions : galerie photo, montants rapides, aperçu des photos, copie du lien, confirmations.
document.addEventListener('DOMContentLoaded', () => {
  // Galerie : clic sur une miniature
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const main = gallery.querySelector('[data-gallery-main]');
    gallery.querySelectorAll('.thumb').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        main.src = thumb.dataset.src;
        gallery.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('active', t === thumb));
      });
    });
  });

  // Montants suggérés
  document.querySelectorAll('[data-contribute]').forEach((form) => {
    const input = form.querySelector('input[name="amount"]');
    const chips = form.querySelectorAll('[data-amount]');
    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        input.value = chip.dataset.amount;
        chips.forEach((c) => c.classList.toggle('active', c === chip));
      })
    );
    input.addEventListener('input', () => chips.forEach((c) => c.classList.toggle('active', c.dataset.amount === input.value)));
  });

  // Aperçu des photos avant envoi
  document.querySelectorAll('[data-preview]').forEach((input) => {
    const target = input.closest('.field').querySelector('[data-preview-target]');
    input.addEventListener('change', () => {
      target.innerHTML = '';
      [...input.files].forEach((file) => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        target.appendChild(img);
      });
    });
  });

  // Copier le lien de partage
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const input = btn.parentElement.querySelector('[data-copy-src]');
      try {
        await navigator.clipboard.writeText(input.value);
      } catch {
        input.select();
        document.execCommand('copy');
      }
      btn.textContent = 'Copié ✓';
      setTimeout(() => (btn.textContent = 'Copier'), 2000);
    });
  });

  // Confirmation avant suppression
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
});
