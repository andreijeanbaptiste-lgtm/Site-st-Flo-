const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const db = require('./lib/db');
const auth = require('./lib/auth');
const stripe = require('./lib/stripe');
const views = require('./lib/views');

const PORT = process.env.PORT || 3000;
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.use('/uploads', express.static(db.UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: db.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 15 },
  fileFilter: (req, file, cb) =>
    IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(new Error(`« ${file.originalname} » n'est pas une image (JPG, PNG, WEBP ou GIF).`)),
}).array('photos', 15);

// Exécute multer et transforme ses erreurs en message lisible (req.uploadError).
function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      req.uploadError =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Une photo dépasse 10 Mo. Réduisez sa taille et réessayez.'
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Maximum 15 photos à la fois.'
            : err.message;
      (req.files || []).forEach((f) => removePhoto(f.filename));
      req.files = [];
      req.body = req.body || {};
    }
    next();
  });
}

function removePhoto(filename) {
  const file = path.join(db.UPLOAD_DIR, path.basename(filename));
  fs.promises.unlink(file).catch(() => {});
}

// "89,90" / "89.9" / "89 €" -> 8990 (centimes). Renvoie NaN si invalide.
function parseEuros(input) {
  const s = String(input || '').replace(/[\s€ ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

const clean = (v, max) => String(v || '').trim().slice(0, max);

const baseUrl = (req) => (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

const findCagnotte = (id) => db.data.cagnottes.find((c) => c.id === id);
const findBySlug = (slug) => db.data.cagnottes.find((c) => c.slug === slug);

const FLASH = {
  created: 'La cagnotte a été créée. Partagez le lien ci-dessous avec la famille !',
  saved: 'Modifications enregistrées.',
  deleted: 'Cagnotte supprimée.',
  photo: 'Photos mises à jour.',
  paid: 'Participation marquée comme payée.',
  unpaid: 'Participation remise en attente.',
  removed: 'Participation supprimée.',
  added: 'Participation ajoutée.',
  settings: 'Paramètres enregistrés.',
  password: 'Mot de passe modifié.',
};
const flashFrom = (req) => (FLASH[req.query.ok] ? { type: 'success', text: FLASH[req.query.ok] } : null);

// Vérifie auprès de Stripe l'état d'une participation en ligne en attente.
async function syncStripe(contribution) {
  if (!stripe.enabled() || contribution.method !== 'online' || contribution.status !== 'pending' || !contribution.stripeSessionId) return;
  try {
    const session = await stripe.getCheckout(contribution.stripeSessionId);
    if (session.payment_status === 'paid') {
      contribution.status = 'paid';
      contribution.paidAt = new Date().toISOString();
      db.save();
    } else if (session.status === 'expired') {
      db.data.contributions = db.data.contributions.filter((x) => x.id !== contribution.id);
      db.save();
    }
  } catch (e) {
    console.error('Stripe :', e.message);
  }
}

// Lit les champs du formulaire de cagnotte. Renvoie { values, errors }.
function readCagnotteForm(body) {
  const errors = [];
  const values = {
    title: clean(body.title, 120),
    childName: clean(body.childName, 60),
    occasion: clean(body.occasion, 40),
    description: clean(body.description, 2000),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(body.deadline || '') ? body.deadline : '',
    price: parseEuros(body.price),
    showPrice: body.showPrice === 'on',
    showProgress: body.showProgress === 'on',
    showContributors: body.showContributors === 'on',
    isPublic: body.isPublic === 'on',
    status: body.open === 'on' ? 'open' : 'closed',
  };
  if (!values.title) errors.push('Le titre est obligatoire.');
  if (!(values.price > 0) || values.price > 100000000) {
    errors.push('Le prix doit être un montant valide (ex. : 49,90).');
    values.price = 0;
  }
  return { values, errors };
}

/* ------------------------------------------------------------------ */
/* Pages publiques                                                     */
/* ------------------------------------------------------------------ */

app.get('/', (req, res) => {
  const list = db.data.cagnottes
    .filter((c) => c.isPublic && c.status === 'open')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.send(String(views.home(list)));
});

function renderCagnotte(res, c, extra = {}) {
  const contributions = db.data.contributions
    .filter((x) => x.cagnotteId === c.id && x.status === 'paid')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.send(String(views.cagnottePage(c, { contributions, stripeEnabled: stripe.enabled(), ...extra })));
}

app.get('/c/:slug', (req, res) => {
  const c = findBySlug(req.params.slug);
  if (!c) return res.status(404).send(String(views.notFound()));
  // Retour depuis Stripe sans paiement : on retire la participation en attente.
  if (req.query.annule) {
    const x = db.data.contributions.find((y) => y.id === req.query.annule && y.status === 'pending' && y.method === 'online');
    if (x) {
      db.data.contributions = db.data.contributions.filter((y) => y !== x);
      db.save();
    }
  }
  renderCagnotte(res, c);
});

app.post('/c/:slug/participer', async (req, res) => {
  const c = findBySlug(req.params.slug);
  if (!c) return res.status(404).send(String(views.notFound()));
  if (req.body.website) return res.redirect(`/c/${c.slug}`); // pot de miel anti-robots

  const values = {
    amount: clean(req.body.amount, 20),
    name: clean(req.body.name, 80),
    email: clean(req.body.email, 120),
    message: clean(req.body.message, 500),
  };
  const method = req.body.method === 'online' && stripe.enabled() ? 'online' : 'store';
  const amount = parseEuros(values.amount);
  const errors = [];
  if (c.status !== 'open') errors.push('Cette cagnotte est terminée.');
  if (!(amount >= 100)) errors.push('Le montant minimum est de 1 €.');
  if (amount > 500000) errors.push('Le montant maximum est de 5 000 €.');
  if (!values.name) errors.push('Merci d\'indiquer votre nom.');
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('L\'adresse e-mail semble invalide.');
  if (errors.length) return renderCagnotte(res.status(400), c, { errors, values });

  const contribution = {
    id: db.newId(),
    cagnotteId: c.id,
    ...values,
    amount,
    method,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (method === 'online') {
    try {
      const base = baseUrl(req);
      const session = await stripe.createCheckout({
        amount,
        title: c.childName ? `${c.title} (pour ${c.childName})` : c.title,
        contributionId: contribution.id,
        email: values.email,
        successUrl: `${base}/merci/${contribution.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/c/${c.slug}?annule=${contribution.id}`,
      });
      contribution.stripeSessionId = session.id;
      db.data.contributions.push(contribution);
      db.save();
      return res.redirect(303, session.url);
    } catch (e) {
      console.error('Stripe :', e.message);
      return renderCagnotte(res.status(502), c, {
        errors: ['Le paiement en ligne est momentanément indisponible. Réessayez ou choisissez « En boutique ».'],
        values,
      });
    }
  }

  db.data.contributions.push(contribution);
  db.save();
  res.redirect(303, `/merci/${contribution.id}`);
});

app.get('/merci/:id', async (req, res) => {
  const x = db.data.contributions.find((y) => y.id === req.params.id);
  const c = x && findCagnotte(x.cagnotteId);
  if (!c) return res.status(404).send(String(views.notFound()));
  await syncStripe(x);
  res.send(String(views.thanks(c, x)));
});

/* ------------------------------------------------------------------ */
/* Espace gérant : connexion                                           */
/* ------------------------------------------------------------------ */

// Mot de passe initial fourni par l'hébergement (facultatif).
if (!db.data.settings.passwordHash && process.env.ADMIN_PASSWORD) {
  db.data.settings.passwordHash = auth.hashPassword(process.env.ADMIN_PASSWORD);
  db.save();
}

app.get('/admin/installation', (req, res) => {
  if (db.data.settings.passwordHash) return res.redirect('/admin');
  res.send(String(views.authPage({ title: 'Créer le mot de passe gérant', action: '/admin/installation', setup: true })));
});

app.post('/admin/installation', (req, res) => {
  if (db.data.settings.passwordHash) return res.redirect('/admin');
  const { password = '', confirm = '' } = req.body;
  const error = password.length < 8 ? '8 caractères minimum.' : password !== confirm ? 'Les deux mots de passe ne correspondent pas.' : null;
  if (error) return res.status(400).send(String(views.authPage({ title: 'Créer le mot de passe gérant', action: '/admin/installation', setup: true, error })));
  db.data.settings.passwordHash = auth.hashPassword(password);
  db.save();
  auth.login(req, res);
  res.redirect('/admin');
});

app.get('/admin/connexion', (req, res) => {
  if (!db.data.settings.passwordHash) return res.redirect('/admin/installation');
  if (auth.isLoggedIn(req)) return res.redirect('/admin');
  res.send(String(views.authPage({ title: 'Espace gérant', action: '/admin/connexion' })));
});

app.post('/admin/connexion', (req, res) => {
  const page = (error) => String(views.authPage({ title: 'Espace gérant', action: '/admin/connexion', error }));
  if (auth.tooManyAttempts(req.ip)) return res.status(429).send(page('Trop de tentatives. Réessayez dans 15 minutes.'));
  if (!auth.verifyPassword(String(req.body.password || ''), db.data.settings.passwordHash)) {
    auth.recordFailure(req.ip);
    return res.status(401).send(page('Mot de passe incorrect.'));
  }
  auth.login(req, res);
  res.redirect('/admin');
});

app.post('/admin/deconnexion', (req, res) => {
  auth.logout(res);
  res.redirect('/');
});

/* ------------------------------------------------------------------ */
/* Espace gérant : cagnottes                                           */
/* ------------------------------------------------------------------ */

const admin = express.Router();
admin.use(auth.requireAdmin);
// Protection CSRF : les formulaires de l'admin doivent venir du site lui-même.
admin.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const origin = req.get('origin') || req.get('referer');
  let host = null;
  try {
    host = origin && new URL(origin).host;
  } catch {}
  if (origin && host !== req.get('host')) return res.status(403).send('Requête refusée.');
  next();
});

admin.get('/', async (req, res) => {
  const list = [...db.data.cagnottes].sort((a, b) =>
    a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'open' ? -1 : 1
  );
  res.send(String(views.dashboard(list, flashFrom(req))));
});

admin.get('/nouvelle', (req, res) => res.send(String(views.newCagnotte({}, []))));

admin.post('/nouvelle', handleUpload, (req, res) => {
  const { values, errors } = readCagnotteForm(req.body);
  if (req.uploadError) errors.push(req.uploadError);
  if (errors.length) {
    (req.files || []).forEach((f) => removePhoto(f.filename));
    return res.status(400).send(String(views.newCagnotte(values, errors)));
  }
  const c = {
    id: db.newId(),
    slug: db.uniqueSlug(values.childName ? `${values.childName} ${values.title}` : values.title),
    ...values,
    photos: (req.files || []).map((f) => f.filename),
    createdAt: new Date().toISOString(),
  };
  db.data.cagnottes.push(c);
  db.save();
  res.redirect(`/admin/c/${c.id}?ok=created`);
});

async function renderEdit(req, res, c, extra = {}) {
  const pendingOnline = db.data.contributions.filter((x) => x.cagnotteId === c.id && x.status === 'pending' && x.method === 'online');
  await Promise.all(pendingOnline.map(syncStripe));
  const contributions = db.data.contributions
    .filter((x) => x.cagnotteId === c.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.send(
    String(views.editCagnotte(c, { contributions, flash: flashFrom(req), publicUrl: `${baseUrl(req)}/c/${c.slug}`, ...extra }))
  );
}

admin.get('/c/:id', async (req, res) => {
  const c = findCagnotte(req.params.id);
  if (!c) return res.redirect('/admin');
  await renderEdit(req, res, c);
});

admin.post('/c/:id', handleUpload, async (req, res) => {
  const c = findCagnotte(req.params.id);
  if (!c) return res.redirect('/admin');
  const { values, errors } = readCagnotteForm(req.body);
  if (req.uploadError) errors.push(req.uploadError);
  if (errors.length) {
    (req.files || []).forEach((f) => removePhoto(f.filename));
    return renderEdit(req, res.status(400), { ...c, ...values, price: values.price || c.price }, { errors });
  }
  Object.assign(c, values, { updatedAt: new Date().toISOString() });
  c.photos.push(...(req.files || []).map((f) => f.filename));
  db.save();
  res.redirect(`/admin/c/${c.id}?ok=saved`);
});

admin.post('/c/:id/photo/supprimer', (req, res) => {
  const c = findCagnotte(req.params.id);
  if (!c) return res.redirect('/admin');
  if (c.photos.includes(req.body.photo)) {
    c.photos = c.photos.filter((p) => p !== req.body.photo);
    removePhoto(req.body.photo);
    db.save();
  }
  res.redirect(`/admin/c/${c.id}?ok=photo`);
});

admin.post('/c/:id/photo/principale', (req, res) => {
  const c = findCagnotte(req.params.id);
  if (!c) return res.redirect('/admin');
  if (c.photos.includes(req.body.photo)) {
    c.photos = [req.body.photo, ...c.photos.filter((p) => p !== req.body.photo)];
    db.save();
  }
  res.redirect(`/admin/c/${c.id}?ok=photo`);
});

admin.post('/c/:id/supprimer', (req, res) => {
  const c = findCagnotte(req.params.id);
  if (c) {
    c.photos.forEach(removePhoto);
    db.data.cagnottes = db.data.cagnottes.filter((x) => x.id !== c.id);
    db.data.contributions = db.data.contributions.filter((x) => x.cagnotteId !== c.id);
    db.save();
  }
  res.redirect('/admin?ok=deleted');
});

/* ------------------------------------------------------------------ */
/* Espace gérant : participations                                      */
/* ------------------------------------------------------------------ */

admin.post('/c/:id/participation', (req, res) => {
  const c = findCagnotte(req.params.id);
  if (!c) return res.redirect('/admin');
  const amount = parseEuros(req.body.amount);
  const name = clean(req.body.name, 80);
  if (amount > 0 && name) {
    const now = new Date().toISOString();
    db.data.contributions.push({
      id: db.newId(),
      cagnotteId: c.id,
      name,
      email: '',
      message: clean(req.body.message, 500),
      amount,
      method: 'store',
      status: 'paid',
      createdAt: now,
      paidAt: now,
    });
    db.save();
  }
  res.redirect(`/admin/c/${c.id}?ok=added`);
});

function updateContribution(action) {
  return (req, res) => {
    const x = db.data.contributions.find((y) => y.id === req.params.id);
    if (!x) return res.redirect('/admin');
    if (action === 'paid') Object.assign(x, { status: 'paid', paidAt: new Date().toISOString() });
    if (action === 'unpaid') Object.assign(x, { status: 'pending', paidAt: null });
    if (action === 'removed') db.data.contributions = db.data.contributions.filter((y) => y !== x);
    db.save();
    res.redirect(`/admin/c/${x.cagnotteId}?ok=${action}`);
  };
}
admin.post('/participation/:id/payee', updateContribution('paid'));
admin.post('/participation/:id/attente', updateContribution('unpaid'));
admin.post('/participation/:id/supprimer', updateContribution('removed'));

/* ------------------------------------------------------------------ */
/* Espace gérant : paramètres                                          */
/* ------------------------------------------------------------------ */

const SETTINGS_FIELDS = {
  shopName: 80, tagline: 160, intro: 1000, address: 300, hours: 300, phone: 30,
  email: 120, instagram: 200, facebook: 200, storePaymentNote: 1000,
};

admin.get('/parametres', (req, res) =>
  res.send(String(views.settingsPage({ flash: flashFrom(req), stripeEnabled: stripe.enabled() })))
);

admin.post('/parametres', (req, res) => {
  const s = db.data.settings;
  const errors = [];
  for (const [key, max] of Object.entries(SETTINGS_FIELDS)) s[key] = clean(req.body[key], max);
  for (const key of ['instagram', 'facebook']) {
    if (s[key] && !/^https?:\/\//.test(s[key])) {
      errors.push(`Le lien ${key} doit commencer par https://`);
      s[key] = '';
    }
  }
  if (!s.shopName) {
    s.shopName = 'Ma boutique';
    errors.push('Le nom de la boutique est obligatoire.');
  }
  db.save();
  if (errors.length) return res.status(400).send(String(views.settingsPage({ errors, stripeEnabled: stripe.enabled() })));
  res.redirect('/admin/parametres?ok=settings');
});

admin.post('/mot-de-passe', (req, res) => {
  const { current = '', password = '', confirm = '' } = req.body;
  const errors = [];
  if (!auth.verifyPassword(current, db.data.settings.passwordHash)) errors.push('Mot de passe actuel incorrect.');
  if (password.length < 8) errors.push('Le nouveau mot de passe doit faire au moins 8 caractères.');
  if (password !== confirm) errors.push('Les deux nouveaux mots de passe ne correspondent pas.');
  if (errors.length) return res.status(400).send(String(views.settingsPage({ errors, stripeEnabled: stripe.enabled() })));
  db.data.settings.passwordHash = auth.hashPassword(password);
  db.save();
  auth.login(req, res); // nouvelle session (les autres appareils sont déconnectés)
  res.redirect('/admin/parametres?ok=password');
});

app.use('/admin', admin);

app.use((req, res) => res.status(404).send(String(views.notFound())));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Une erreur est survenue.');
});

app.listen(PORT, () => {
  console.log(`🧸 Site des cagnottes : http://localhost:${PORT}`);
  console.log(`🔐 Espace gérant      : http://localhost:${PORT}/admin`);
  if (!stripe.enabled()) console.log('ℹ️  Paiement en ligne désactivé (STRIPE_SECRET_KEY absente) : paiement en boutique uniquement.');
});
