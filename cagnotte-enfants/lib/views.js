// Gabarits HTML (rendu côté serveur, sans moteur de template).
// Le tag html`` échappe automatiquement toutes les valeurs insérées,
// sauf celles passées par raw() ou produites par un autre html``.
const db = require('./db');

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
const raw = (s) => new Raw(String(s));

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function render(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (v instanceof Raw) return v.s;
  return esc(v);
}

function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1];
  });
  return raw(out);
}

const euroFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const euros = (cents) => euroFmt.format((cents || 0) / 100).replace(/,00\s/, ' ');
const centsToInput = (cents) => (cents ? (cents / 100).toFixed(2).replace('.', ',').replace(',00', '') : '');
const dateFmt = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFmt = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const photoUrl = (p) => `/uploads/${encodeURIComponent(p)}`;

function nl2br(text) {
  return raw(esc(text).replace(/\n/g, '<br>'));
}

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

function layout({ title, body, admin = false, flash, description }) {
  const s = db.data.settings;
  const pageTitle = title ? `${title} · ${s.shopName}` : s.shopName;
  return html`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<meta name="description" content="${description || s.tagline}">
${admin ? raw('<meta name="robots" content="noindex">') : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/style.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎁</text></svg>">
</head>
<body class="${admin ? 'is-admin' : ''}">
${admin ? adminHeader() : publicHeader()}
<main class="container">
${flash ? html`<div class="flash flash-${flash.type}">${flash.text}</div>` : ''}
${body}
</main>
${admin ? '' : publicFooter()}
<script src="/static/app.js" defer></script>
</body>
</html>`;
}

function publicHeader() {
  const s = db.data.settings;
  return html`<header class="site-header">
  <div class="container header-inner">
    <a href="/" class="brand"><span class="brand-icon">🧸</span><span>${s.shopName}</span></a>
    <nav><a href="/#cagnottes">Les cagnottes</a><a href="/#infos">La boutique</a></nav>
  </div>
</header>`;
}

function publicFooter() {
  const s = db.data.settings;
  return html`<footer class="site-footer" id="infos">
  <div class="container footer-grid">
    <div>
      <div class="brand"><span class="brand-icon">🧸</span><span>${s.shopName}</span></div>
      <p class="muted">${s.tagline}</p>
    </div>
    <div>
      ${s.address ? html`<p>📍 ${nl2br(s.address)}</p>` : ''}
      ${s.hours ? html`<p>🕑 ${nl2br(s.hours)}</p>` : ''}
    </div>
    <div>
      ${s.phone ? html`<p>📞 <a href="tel:${s.phone.replace(/\s/g, '')}">${s.phone}</a></p>` : ''}
      ${s.email ? html`<p>✉️ <a href="mailto:${s.email}">${s.email}</a></p>` : ''}
      ${s.instagram ? html`<p><a href="${s.instagram}" target="_blank" rel="noopener">Instagram</a></p>` : ''}
      ${s.facebook ? html`<p><a href="${s.facebook}" target="_blank" rel="noopener">Facebook</a></p>` : ''}
    </div>
  </div>
  <div class="container footer-bottom muted">© ${new Date().getFullYear()} ${s.shopName} · <a href="/admin">Espace gérant</a></div>
</footer>`;
}

function adminHeader() {
  const s = db.data.settings;
  return html`<header class="site-header admin-header">
  <div class="container header-inner">
    <a href="/admin" class="brand"><span class="brand-icon">🧸</span><span>${s.shopName}</span><span class="badge">Gérant</span></a>
    <nav>
      <a href="/admin">Cagnottes</a>
      <a href="/admin/nouvelle">+ Nouvelle</a>
      <a href="/admin/parametres">Paramètres</a>
      <a href="/" target="_blank">Voir le site ↗</a>
      <form method="post" action="/admin/deconnexion" class="inline"><button class="link">Déconnexion</button></form>
    </nav>
  </div>
</header>`;
}

/* ------------------------------------------------------------------ */
/* Composants                                                          */
/* ------------------------------------------------------------------ */

function progress(c, { forceShow = false } = {}) {
  const got = db.collected(c.id);
  const pct = c.price ? Math.min(100, Math.round((got / c.price) * 100)) : 0;
  if (!forceShow && !c.showProgress && !c.showPrice) return '';
  return html`<div class="progress-wrap">
    <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="progress-label">
      ${forceShow || c.showPrice
        ? html`<strong>${euros(got)}</strong> récoltés sur ${euros(c.price)}`
        : html`<strong>${pct} %</strong> de l'objectif atteint`}
      ${pct >= 100 ? html`<span class="tag tag-success">Objectif atteint 🎉</span>` : ''}
    </div>
  </div>`;
}

function card(c) {
  const count = db.data.contributions.filter((x) => x.cagnotteId === c.id && x.status === 'paid').length;
  return html`<a class="card" href="/c/${c.slug}">
    <div class="card-img">
      ${c.photos[0] ? html`<img src="${photoUrl(c.photos[0])}" alt="${c.title}" loading="lazy">` : html`<div class="no-photo">🎁</div>`}
      ${c.occasion ? html`<span class="ribbon">${c.occasion}</span>` : ''}
    </div>
    <div class="card-body">
      ${c.childName ? html`<div class="for">Pour ${c.childName}</div>` : ''}
      <h3>${c.title}</h3>
      ${c.showPrice ? html`<div class="price">${euros(c.price)}</div>` : ''}
      ${progress(c)}
      <div class="card-foot">
        <span class="muted">${count} participant${count > 1 ? 's' : ''}</span>
        <span class="btn btn-small">Participer</span>
      </div>
    </div>
  </a>`;
}

/* ------------------------------------------------------------------ */
/* Pages publiques                                                     */
/* ------------------------------------------------------------------ */

function home(cagnottes) {
  const s = db.data.settings;
  return layout({
    body: html`
<section class="hero">
  <div class="hero-text">
    <span class="eyebrow">Cagnottes cadeaux</span>
    <h1>Un cadeau, <span class="hl">plein de cœurs</span> 💛</h1>
    <p class="lead">${nl2br(s.intro)}</p>
    <a class="btn" href="#cagnottes">Voir les cagnottes</a>
  </div>
  <div class="hero-art" aria-hidden="true"><span>👗</span><span>🧸</span><span>👟</span><span>🎀</span></div>
</section>

<section class="steps">
  <div class="step"><span>1</span><h3>Choisissez</h3><p>Trouvez la cagnotte de l'enfant à gâter.</p></div>
  <div class="step"><span>2</span><h3>Participez</h3><p>Donnez le montant de votre choix, avec un petit mot.</p></div>
  <div class="step"><span>3</span><h3>On s'occupe du reste</h3><p>La boutique prépare le cadeau, emballé avec soin.</p></div>
</section>

<section id="cagnottes">
  <h2 class="section-title">Les cagnottes en cours</h2>
  ${cagnottes.length
    ? html`<div class="grid">${cagnottes.map(card)}</div>`
    : html`<div class="empty">Aucune cagnotte publique pour le moment.<br>Vous avez reçu un lien ? Ouvrez-le directement pour participer.</div>`}
</section>`,
  });
}

function cagnottePage(c, { contributions, stripeEnabled, errors = [], values = {} }) {
  const got = db.collected(c.id);
  const remaining = Math.max(0, c.price - got);
  const closed = c.status === 'closed';
  const suggestions = [10, 20, 30, 50];

  return layout({
    title: c.title,
    description: c.description?.slice(0, 160),
    body: html`
<a href="/" class="back">← Toutes les cagnottes</a>
<article class="detail">
  <div class="gallery" data-gallery>
    <div class="gallery-main">
      ${c.photos[0]
        ? html`<img src="${photoUrl(c.photos[0])}" alt="${c.title}" data-gallery-main>`
        : html`<div class="no-photo big">🎁</div>`}
    </div>
    ${c.photos.length > 1
      ? html`<div class="thumbs">${c.photos.map(
          (p, i) => html`<button type="button" class="thumb ${i === 0 ? 'active' : ''}" data-src="${photoUrl(p)}"><img src="${photoUrl(p)}" alt=""></button>`
        )}</div>`
      : ''}
  </div>

  <div class="detail-info">
    ${c.occasion ? html`<span class="eyebrow">${c.occasion}</span>` : ''}
    <h1>${c.title}</h1>
    ${c.childName ? html`<p class="for big">Pour ${c.childName} 💝</p>` : ''}
    ${c.showPrice ? html`<div class="price big">${euros(c.price)}</div>` : ''}
    ${c.description ? html`<p class="desc">${nl2br(c.description)}</p>` : ''}
    ${c.deadline ? html`<p class="muted">📅 Participations jusqu'au ${dateFmt(c.deadline)}</p>` : ''}
    ${progress(c)}

    ${closed
      ? html`<div class="box closed">Cette cagnotte est terminée. Merci à tous les participants ! 🎉</div>`
      : html`
    <form method="post" action="/c/${c.slug}/participer" class="box contribute" data-contribute>
      <h2>Je participe</h2>
      ${errors.length ? html`<div class="flash flash-error">${errors.map((e) => html`<div>${e}</div>`)}</div>` : ''}
      <label>Montant de ma participation</label>
      <div class="amounts">
        ${suggestions.map((a) => html`<button type="button" class="chip" data-amount="${a}">${a} €</button>`)}
        ${c.showPrice && remaining > 0
          ? html`<button type="button" class="chip" data-amount="${centsToInput(remaining)}">Compléter (${euros(remaining)})</button>`
          : ''}
      </div>
      <div class="input-euro"><input name="amount" inputmode="decimal" required placeholder="Autre montant" value="${values.amount || ''}"><span>€</span></div>

      <label for="name">Votre nom <small class="muted">(visible par la famille)</small></label>
      <input id="name" name="name" required maxlength="80" value="${values.name || ''}" placeholder="Ex. : Tata Julie">

      <label for="email">Votre e-mail <small class="muted">(facultatif, non affiché)</small></label>
      <input id="email" name="email" type="email" maxlength="120" value="${values.email || ''}">

      <label for="message">Un petit mot <small class="muted">(facultatif)</small></label>
      <textarea id="message" name="message" maxlength="500" rows="3" placeholder="Joyeux anniversaire !">${values.message || ''}</textarea>

      <label>Mode de paiement</label>
      <div class="pay-options">
        ${stripeEnabled
          ? html`<label class="radio-card"><input type="radio" name="method" value="online" checked><span><strong>💳 Carte bancaire en ligne</strong><small>Paiement sécurisé immédiat</small></span></label>`
          : ''}
        <label class="radio-card"><input type="radio" name="method" value="store" ${stripeEnabled ? '' : raw('checked')}><span><strong>🏪 En boutique</strong><small>Je règle sur place</small></span></label>
      </div>
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn btn-block">Valider ma participation</button>
    </form>`}

    ${c.showContributors && contributions.length
      ? html`<div class="box">
      <h2>Ils ont participé 💌</h2>
      <ul class="contributors">
        ${contributions.map(
          (x) => html`<li><strong>${x.name}</strong>${x.message ? html`<p>« ${x.message} »</p>` : ''}</li>`
        )}
      </ul>
    </div>`
      : ''}
  </div>
</article>`,
  });
}

function thanks(c, contribution) {
  const s = db.data.settings;
  const paid = contribution.status === 'paid';
  return layout({
    title: 'Merci !',
    body: html`
<div class="thanks box">
  <div class="big-emoji">${paid ? '🎉' : '🛍️'}</div>
  <h1>Merci ${contribution.name} !</h1>
  ${paid
    ? html`<p class="lead">Votre participation de <strong>${euros(contribution.amount)}</strong> à la cagnotte « ${c.title} » a bien été enregistrée.</p>`
    : contribution.method === 'store'
      ? html`<p class="lead">Votre participation de <strong>${euros(contribution.amount)}</strong> à la cagnotte « ${c.title} » est réservée.</p>
         <p>${nl2br(s.storePaymentNote)}</p>
         ${s.address ? html`<p>📍 ${nl2br(s.address)}</p>` : ''}
         ${s.hours ? html`<p>🕑 ${nl2br(s.hours)}</p>` : ''}`
      : html`<p class="lead">Votre paiement est en cours de vérification. Si vous avez été débité, la participation apparaîtra sous peu.</p>`}
  <a class="btn" href="/c/${c.slug}">Retour à la cagnotte</a>
</div>`,
  });
}

function notFound() {
  return layout({
    title: 'Page introuvable',
    body: html`<div class="thanks box"><div class="big-emoji">🧦</div><h1>Oups, page introuvable</h1><p>Cette cagnotte n'existe pas ou n'est plus disponible.</p><a class="btn" href="/">Retour à l'accueil</a></div>`,
  });
}

/* ------------------------------------------------------------------ */
/* Espace gérant                                                       */
/* ------------------------------------------------------------------ */

function authPage({ title, action, setup = false, error }) {
  return layout({
    title,
    admin: false,
    body: html`
<form method="post" action="${action}" class="box auth">
  <div class="big-emoji">🔐</div>
  <h1>${title}</h1>
  ${setup ? html`<p class="muted">Première utilisation : choisissez le mot de passe de l'espace gérant (8 caractères minimum).</p>` : ''}
  ${error ? html`<div class="flash flash-error">${error}</div>` : ''}
  <label for="password">Mot de passe</label>
  <input id="password" name="password" type="password" required autofocus minlength="${setup ? 8 : 1}" autocomplete="${setup ? 'new-password' : 'current-password'}">
  ${setup
    ? html`<label for="confirm">Confirmer le mot de passe</label><input id="confirm" name="confirm" type="password" required minlength="8" autocomplete="new-password">`
    : ''}
  <button class="btn btn-block">${setup ? 'Créer et entrer' : 'Se connecter'}</button>
</form>`,
  });
}

function dashboard(cagnottes, flash) {
  const all = db.data.contributions;
  const totalPaid = all.filter((x) => x.status === 'paid').reduce((s, x) => s + x.amount, 0);
  const pendingList = all.filter((x) => x.status === 'pending');
  const open = cagnottes.filter((c) => c.status === 'open').length;

  return layout({
    title: 'Tableau de bord',
    admin: true,
    flash,
    body: html`
<div class="admin-top">
  <h1>Mes cagnottes</h1>
  <a class="btn" href="/admin/nouvelle">+ Nouvelle cagnotte</a>
</div>

<div class="stats">
  <div class="stat"><span>${open}</span>cagnotte${open > 1 ? 's' : ''} ouverte${open > 1 ? 's' : ''}</div>
  <div class="stat"><span>${euros(totalPaid)}</span>encaissés au total</div>
  <div class="stat ${pendingList.length ? 'warn' : ''}"><span>${pendingList.length}</span>participation${pendingList.length > 1 ? 's' : ''} à valider</div>
</div>

${cagnottes.length
  ? html`<div class="table-wrap"><table class="table">
  <thead><tr><th></th><th>Cagnotte</th><th>Prix</th><th>Récolté</th><th>En attente</th><th>Statut</th><th></th></tr></thead>
  <tbody>
  ${cagnottes.map((c) => {
    const got = db.collected(c.id);
    const pend = db.pending(c.id);
    return html`<tr>
      <td>${c.photos[0] ? html`<img class="mini" src="${photoUrl(c.photos[0])}" alt="">` : html`<div class="mini no-photo">🎁</div>`}</td>
      <td><a href="/admin/c/${c.id}"><strong>${c.title}</strong></a>${c.childName ? html`<div class="muted">Pour ${c.childName}</div>` : ''}</td>
      <td>${euros(c.price)} ${c.showPrice ? '' : html`<span class="tag" title="Prix masqué au public">masqué</span>`}</td>
      <td>${euros(got)} <small class="muted">(${c.price ? Math.round((got / c.price) * 100) : 0} %)</small></td>
      <td>${pend ? html`<span class="tag tag-warn">${euros(pend)}</span>` : '—'}</td>
      <td>${c.status === 'open' ? html`<span class="tag tag-success">Ouverte</span>` : html`<span class="tag">Terminée</span>`}
          ${c.isPublic ? '' : html`<span class="tag" title="Accessible uniquement par lien">lien privé</span>`}</td>
      <td class="actions"><a class="btn btn-small btn-ghost" href="/admin/c/${c.id}">Gérer</a></td>
    </tr>`;
  })}
  </tbody></table></div>`
  : html`<div class="empty">Aucune cagnotte pour l'instant. <a href="/admin/nouvelle">Créez la première !</a></div>`}`,
  });
}

function cagnotteForm(c = {}, { errors = [] } = {}) {
  const isNew = !c.id;
  const checked = (v, def) => ((v === undefined ? def : v) ? raw('checked') : '');
  return html`
<form method="post" action="${isNew ? '/admin/nouvelle' : `/admin/c/${c.id}`}" enctype="multipart/form-data" class="box admin-form">
  ${errors.length ? html`<div class="flash flash-error">${errors.map((e) => html`<div>${e}</div>`)}</div>` : ''}
  <div class="form-grid">
    <div class="field full">
      <label for="title">Titre de l'article *</label>
      <input id="title" name="title" required maxlength="120" value="${c.title || ''}" placeholder="Ex. : Robe à fleurs + gilet en maille">
    </div>
    <div class="field">
      <label for="childName">Prénom de l'enfant</label>
      <input id="childName" name="childName" maxlength="60" value="${c.childName || ''}" placeholder="Ex. : Léa">
    </div>
    <div class="field">
      <label for="occasion">Occasion</label>
      <input id="occasion" name="occasion" maxlength="40" list="occasions" value="${c.occasion || ''}" placeholder="Ex. : Anniversaire">
      <datalist id="occasions"><option>Anniversaire</option><option>Naissance</option><option>Baptême</option><option>Noël</option><option>Rentrée</option></datalist>
    </div>
    <div class="field">
      <label for="price">Prix (€) *</label>
      <div class="input-euro"><input id="price" name="price" required inputmode="decimal" value="${centsToInput(c.price)}" placeholder="Ex. : 89,90"><span>€</span></div>
    </div>
    <div class="field">
      <label for="deadline">Date limite <small class="muted">(facultatif)</small></label>
      <input id="deadline" name="deadline" type="date" value="${c.deadline || ''}">
    </div>
    <div class="field full">
      <label for="description">Description</label>
      <textarea id="description" name="description" rows="4" maxlength="2000" placeholder="Taille, couleur, matière…">${c.description || ''}</textarea>
    </div>
    <div class="field full">
      <label for="photos">${isNew ? 'Photos' : 'Ajouter des photos'} <small class="muted">(JPG, PNG, WEBP — 10 Mo max chacune)</small></label>
      <input id="photos" name="photos" type="file" accept="image/*" multiple data-preview>
      <div class="preview" data-preview-target></div>
    </div>
  </div>

  <fieldset class="options">
    <legend>Options d'affichage</legend>
    <label class="switch"><input type="checkbox" name="showPrice" ${checked(c.showPrice, true)}><span></span><div><strong>Afficher le prix</strong><small>Les visiteurs voient le prix de l'article et les montants récoltés.</small></div></label>
    <label class="switch"><input type="checkbox" name="showProgress" ${checked(c.showProgress, true)}><span></span><div><strong>Afficher la progression</strong><small>Barre de progression en %, même si le prix est masqué.</small></div></label>
    <label class="switch"><input type="checkbox" name="showContributors" ${checked(c.showContributors, true)}><span></span><div><strong>Afficher les participants</strong><small>Noms et petits mots (jamais les montants individuels).</small></div></label>
    <label class="switch"><input type="checkbox" name="isPublic" ${checked(c.isPublic, true)}><span></span><div><strong>Visible sur la page d'accueil</strong><small>Si décoché, la cagnotte n'est accessible que via son lien.</small></div></label>
    <label class="switch"><input type="checkbox" name="open" ${checked(c.status === undefined ? true : c.status === 'open', true)}><span></span><div><strong>Cagnotte ouverte</strong><small>Décochez pour clôturer : plus aucune participation possible.</small></div></label>
  </fieldset>

  <div class="form-actions">
    <a href="/admin" class="btn btn-ghost">Annuler</a>
    <button class="btn">${isNew ? 'Créer la cagnotte' : 'Enregistrer'}</button>
  </div>
</form>`;
}

function newCagnotte(values, errors) {
  return layout({
    title: 'Nouvelle cagnotte',
    admin: true,
    body: html`<a href="/admin" class="back">← Retour</a><h1>Nouvelle cagnotte</h1>${cagnotteForm(values, { errors })}`,
  });
}

function editCagnotte(c, { contributions, flash, errors, publicUrl }) {
  const got = db.collected(c.id);
  return layout({
    title: c.title,
    admin: true,
    flash,
    body: html`
<a href="/admin" class="back">← Retour</a>
<div class="admin-top">
  <h1>${c.title}</h1>
  <a class="btn btn-ghost" href="/c/${c.slug}" target="_blank">Voir la page ↗</a>
</div>

<div class="share box">
  <label>Lien à partager avec la famille</label>
  <div class="copy"><input readonly value="${publicUrl}" data-copy-src><button type="button" class="btn btn-small" data-copy>Copier</button></div>
</div>

${progress(c, { forceShow: true })}

${c.photos.length
  ? html`<div class="box">
  <h2>Photos</h2>
  <div class="photo-admin">
    ${c.photos.map(
      (p, i) => html`<div class="photo-item">
        <img src="${photoUrl(p)}" alt="">
        ${i === 0 ? html`<span class="tag tag-success">Principale</span>` : ''}
        <div class="photo-actions">
          ${i > 0 ? html`<form method="post" action="/admin/c/${c.id}/photo/principale"><input type="hidden" name="photo" value="${p}"><button class="btn btn-small btn-ghost">★ Principale</button></form>` : ''}
          <form method="post" action="/admin/c/${c.id}/photo/supprimer" data-confirm="Supprimer cette photo ?"><input type="hidden" name="photo" value="${p}"><button class="btn btn-small btn-danger">Supprimer</button></form>
        </div>
      </div>`
    )}
  </div>
</div>`
  : ''}

<h2>Informations</h2>
${cagnotteForm(c, { errors })}

<div class="box">
  <div class="admin-top"><h2>Participations</h2><span class="muted">Total encaissé : <strong>${euros(got)}</strong></span></div>
  ${contributions.length
    ? html`<div class="table-wrap"><table class="table">
    <thead><tr><th>Date</th><th>Nom</th><th>Montant</th><th>Paiement</th><th>Message</th><th>Statut</th><th></th></tr></thead>
    <tbody>
    ${contributions.map(
      (x) => html`<tr>
        <td>${dateTimeFmt(x.createdAt)}</td>
        <td><strong>${x.name}</strong>${x.email ? html`<div class="muted"><a href="mailto:${x.email}">${x.email}</a></div>` : ''}</td>
        <td>${euros(x.amount)}</td>
        <td>${x.method === 'online' ? 'Carte en ligne' : 'Boutique'}</td>
        <td class="msg">${x.message || ''}</td>
        <td>${x.status === 'paid' ? html`<span class="tag tag-success">Payée</span>` : html`<span class="tag tag-warn">En attente</span>`}</td>
        <td class="actions">
          ${x.status === 'pending'
            ? html`<form method="post" action="/admin/participation/${x.id}/payee"><button class="btn btn-small">Marquer payée</button></form>`
            : x.method === 'store'
              ? html`<form method="post" action="/admin/participation/${x.id}/attente"><button class="btn btn-small btn-ghost">Annuler paiement</button></form>`
              : ''}
          <form method="post" action="/admin/participation/${x.id}/supprimer" data-confirm="Supprimer définitivement cette participation ?"><button class="btn btn-small btn-danger">Supprimer</button></form>
        </td>
      </tr>`
    )}
    </tbody></table></div>`
    : html`<p class="muted">Aucune participation pour le moment.</p>`}

  <details class="add-manual">
    <summary>+ Enregistrer une participation reçue en boutique</summary>
    <form method="post" action="/admin/c/${c.id}/participation" class="form-grid">
      <div class="field"><label>Nom</label><input name="name" required maxlength="80"></div>
      <div class="field"><label>Montant (€)</label><div class="input-euro"><input name="amount" required inputmode="decimal"><span>€</span></div></div>
      <div class="field full"><label>Message (facultatif)</label><input name="message" maxlength="500"></div>
      <div class="field full"><button class="btn">Ajouter (payée)</button></div>
    </form>
  </details>
</div>

<div class="box danger-zone">
  <h2>Zone dangereuse</h2>
  <p class="muted">Supprime la cagnotte, ses photos et toutes ses participations. Action irréversible.</p>
  <form method="post" action="/admin/c/${c.id}/supprimer" data-confirm="Supprimer définitivement cette cagnotte et toutes ses participations ?">
    <button class="btn btn-danger">Supprimer la cagnotte</button>
  </form>
</div>`,
  });
}

function settingsPage({ flash, errors = [], stripeEnabled }) {
  const s = db.data.settings;
  const field = (name, label, opts = {}) =>
    opts.textarea
      ? html`<div class="field ${opts.full ? 'full' : ''}"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" rows="3" maxlength="1000">${s[name] || ''}</textarea></div>`
      : html`<div class="field ${opts.full ? 'full' : ''}"><label for="${name}">${label}</label><input id="${name}" name="${name}" maxlength="200" value="${s[name] || ''}" ${opts.required ? raw('required') : ''} placeholder="${opts.placeholder || ''}"></div>`;

  return layout({
    title: 'Paramètres',
    admin: true,
    flash,
    body: html`
<h1>Paramètres</h1>
${errors.length ? html`<div class="flash flash-error">${errors.map((e) => html`<div>${e}</div>`)}</div>` : ''}
<form method="post" action="/admin/parametres" class="box admin-form">
  <h2>La boutique</h2>
  <div class="form-grid">
    ${field('shopName', 'Nom de la boutique *', { required: true })}
    ${field('tagline', 'Slogan')}
    ${field('intro', "Texte d'accueil", { textarea: true, full: true })}
    ${field('address', 'Adresse', { textarea: true })}
    ${field('hours', "Horaires d'ouverture", { textarea: true })}
    ${field('phone', 'Téléphone')}
    ${field('email', 'E-mail')}
    ${field('instagram', 'Lien Instagram', { placeholder: 'https://instagram.com/…' })}
    ${field('facebook', 'Lien Facebook', { placeholder: 'https://facebook.com/…' })}
    ${field('storePaymentNote', 'Message affiché après une participation « en boutique »', { textarea: true, full: true })}
  </div>
  <div class="form-actions"><button class="btn">Enregistrer</button></div>
</form>

<form method="post" action="/admin/mot-de-passe" class="box admin-form">
  <h2>Changer le mot de passe</h2>
  <div class="form-grid">
    <div class="field"><label>Mot de passe actuel</label><input type="password" name="current" required autocomplete="current-password"></div>
    <div class="field"></div>
    <div class="field"><label>Nouveau mot de passe</label><input type="password" name="password" required minlength="8" autocomplete="new-password"></div>
    <div class="field"><label>Confirmer</label><input type="password" name="confirm" required minlength="8" autocomplete="new-password"></div>
  </div>
  <div class="form-actions"><button class="btn">Changer le mot de passe</button></div>
</form>

<div class="box">
  <h2>Paiement en ligne</h2>
  ${stripeEnabled
    ? html`<p><span class="tag tag-success">Activé</span> Les participants peuvent payer par carte via Stripe.</p>`
    : html`<p><span class="tag">Désactivé</span> Seul le paiement en boutique est proposé. Pour activer le paiement par carte, renseignez la clé <code>STRIPE_SECRET_KEY</code> sur l'hébergement (voir le README).</p>`}
</div>`,
  });
}

module.exports = {
  html,
  raw,
  home,
  cagnottePage,
  thanks,
  notFound,
  authPage,
  dashboard,
  newCagnotte,
  editCagnotte,
  settingsPage,
};
