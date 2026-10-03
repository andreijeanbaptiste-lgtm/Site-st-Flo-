# 🧸 Cagnottes cadeaux — boutique de vêtements pour enfants

Site où la famille et les amis peuvent **participer ensemble au cadeau d'un enfant**
(comme une cagnotte), avec un **espace gérant** pour que le commerçant gère tout en autonomie.

## Fonctionnalités

**Côté visiteurs**
- Page d'accueil avec les cagnottes en cours (photo, titre, prénom de l'enfant, occasion)
- Page de chaque cagnotte : galerie photos, description, progression, liste des participants et de leurs petits mots
- Participation libre (montants rapides 10 / 20 / 30 / 50 €, ou « Compléter » le reste)
- Paiement **en boutique** (toujours disponible) et **par carte en ligne** (Stripe, facultatif)

**Côté gérant** (`/admin`)
- Créer / modifier / supprimer une cagnotte : titre, prix, prénom, occasion, description, date limite
- Ajouter plusieurs photos, choisir la photo principale, supprimer une photo
- Options pour chaque cagnotte :
  - **Afficher le prix** (oui / non) : si non, ni le prix ni les montants ne sont visibles
  - **Afficher la progression** en % (même si le prix est masqué)
  - **Afficher les participants** (noms et mots, jamais les montants individuels)
  - **Visible sur l'accueil** ou accessible **uniquement par lien** (cagnotte privée)
  - **Ouverte / clôturée**
- Lien de partage à copier en un clic
- Suivi des participations : valider un paiement reçu en boutique, annuler, supprimer, en ajouter une à la main
- Paramètres : nom de la boutique, textes, adresse, horaires, téléphone, réseaux sociaux, mot de passe

## Lancer en local

```bash
cd cagnotte-enfants
npm install
npm start
# Site : http://localhost:3000 — Espace gérant : http://localhost:3000/admin
```

Lors de la première visite sur `/admin`, le site demande de créer le mot de passe gérant.

## Mise en ligne

Il faut un hébergement **Node.js (version 18 ou plus) avec un disque persistant**, car les
cagnottes et les photos sont enregistrées dans le dossier `data/`. Par exemple : un petit VPS,
Render (avec un « Disk »), Railway (avec un « Volume »), Fly.io, ou un hébergeur mutualisé
compatible Node.js (o2switch, Hostinger…).

> ⚠️ GitHub Pages ne convient pas : c'est un hébergement de sites statiques, sans serveur.

Variables d'environnement (toutes facultatives) :

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute (3000 par défaut) |
| `DATA_DIR` | Dossier des données et photos (par défaut `./data`) : à placer sur le disque persistant |
| `ADMIN_PASSWORD` | Mot de passe gérant initial (sinon, il est créé à la première visite de `/admin`) |
| `BASE_URL` | Adresse publique du site, ex. `https://cagnottes.ma-boutique.fr` |
| `STRIPE_SECRET_KEY` | Active le paiement par carte en ligne (clé `sk_live_…` ou `sk_test_…`) |
| `SESSION_SECRET` | Secret des sessions (généré automatiquement sinon) |

Conseil : définissez `ADMIN_PASSWORD` avant la mise en ligne, ou rendez-vous sur `/admin`
juste après le déploiement pour créer le mot de passe avant tout le monde.

### Paiement en ligne (Stripe)

1. Créez un compte sur [stripe.com](https://stripe.com) (au nom de la boutique).
2. Récupérez la clé secrète dans *Développeurs → Clés API*.
3. Renseignez-la dans `STRIPE_SECRET_KEY` sur l'hébergement, puis redémarrez.

Les paiements par carte sont validés automatiquement. Sans clé, seul le paiement en boutique
est proposé : le gérant clique sur « Marquer payée » quand il reçoit l'argent.

## Sauvegarde

Tout est dans le dossier `data/` (`db.json` + `uploads/`) : il suffit de le copier régulièrement.

## Structure

```
server.js          Routes (pages publiques + espace gérant)
lib/db.js          Stockage JSON (data/db.json)
lib/auth.js        Mot de passe gérant + session
lib/stripe.js      Paiement en ligne (facultatif)
lib/views.js       Gabarits HTML
public/            CSS et JavaScript du navigateur
```
