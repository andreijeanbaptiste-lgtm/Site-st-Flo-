// Petite base de données au format JSON (suffisante pour un magasin).
// Toutes les écritures passent par save() qui écrit de manière atomique.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DEFAULT_DB = {
  settings: {
    shopName: 'Les Petits Trésors',
    tagline: 'Vêtements pour enfants de 0 à 14 ans',
    intro:
      "Offrez ensemble le plus beau des cadeaux ! Choisissez une cagnotte, participez du montant de votre choix, et nous préparons le cadeau en boutique.",
    address: '',
    phone: '',
    email: '',
    hours: '',
    instagram: '',
    facebook: '',
    storePaymentNote:
      'Passez en boutique pour régler votre participation (espèces, carte ou chèque). Elle sera validée dès réception.',
    passwordHash: null,
    sessionSecret: crypto.randomBytes(32).toString('hex'),
  },
  cagnottes: [],
  contributions: [],
};

let db;

function load() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db.settings = { ...DEFAULT_DB.settings, ...db.settings };
    db.cagnottes = db.cagnottes || [];
    db.contributions = db.contributions || [];
  } else {
    db = structuredClone(DEFAULT_DB);
    save();
  }
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const newId = () => crypto.randomBytes(8).toString('hex');

function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function uniqueSlug(base) {
  const root = slugify(base) || 'cagnotte';
  let slug = root;
  while (db.cagnottes.some((c) => c.slug === slug)) {
    slug = `${root}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return slug;
}

// Total encaissé (participations validées uniquement)
function collected(cagnotteId) {
  return db.contributions
    .filter((x) => x.cagnotteId === cagnotteId && x.status === 'paid')
    .reduce((sum, x) => sum + x.amount, 0);
}

function pending(cagnotteId) {
  return db.contributions
    .filter((x) => x.cagnotteId === cagnotteId && x.status === 'pending')
    .reduce((sum, x) => sum + x.amount, 0);
}

load();

module.exports = {
  get data() {
    return db;
  },
  save,
  newId,
  uniqueSlug,
  collected,
  pending,
  UPLOAD_DIR,
};
