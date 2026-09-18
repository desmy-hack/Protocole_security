# Coffre-fort web de partage sécurisé de fichiers

**Groupe 01 — Cryptographie appliquée**

Projet réalisé dans le cadre du cours *Protocoles de sécurité réseau*.

## Membres du groupe

| Nom |
|---|
| Akossa Dole Elvis |
| Massevo Lenzo Delss |
| Nimy Bianga Descartes |
| Nzau Umba Jeanson |

## Liens de démonstration

| | Lien |
|---|---|
| **Application déployée** | https://coffre-fort-uccc.onrender.com/|
| **Dépôt GitHub** | https://github.com/desmy-hack/Protocole_security |

**Identifiants de démonstration** :
- E-mail : `demo@example.com`
- Mot de passe de connexion : `à compléter`
- Mot de passe de chiffrement du fichier de démo : `à compléter`

---

## 1. Objectif

Concevoir, développer et déployer une application web démontrant concrètement l'utilisation de protocoles de sécurité réseau et de mécanismes cryptographiques. Le projet retenu par le groupe est un **coffre-fort de partage sécurisé de fichiers** : chaque utilisateur peut déposer un fichier, protégé par un mot de passe de son choix, et obtenir un lien à partager avec un destinataire, qui pourra le déchiffrer sans avoir besoin de créer de compte.

Le principe central : **le serveur ne voit et ne stocke jamais un fichier en clair, ni le mot de passe qui le protège.** Tout le chiffrement et le déchiffrement se font dans le navigateur.

## 2. Mécanismes de sécurité implémentés

| # | Mécanisme | Rôle | Où dans le code |
|---|---|---|---|
| 1 | **HTTPS/TLS** | Chiffre le trafic réseau entre le navigateur et le serveur. Fourni automatiquement par la plateforme de déploiement (Render). | Infrastructure de déploiement |
| 2 | **AES-GCM (256 bits)** | Chiffre le fichier lui-même, côté client, avant tout envoi. Le tag d'authentification intégré à GCM détecte toute altération du fichier chiffré. | `public/js/crypto.js` (`encryptFile`, `decryptFile`) |
| 3 | **PBKDF2 (250 000 itérations, SHA-256)** | Transforme le mot de passe choisi par l'utilisateur (potentiellement faible) en une clé de 256 bits robuste, avec un sel aléatoire propre à chaque fichier. | `public/js/crypto.js` (`deriveKey`) |
| 4 | **SHA-256** | Calcule une empreinte du fichier original, vérifiée après déchiffrement pour confirmer l'intégrité de bout en bout. | `public/js/crypto.js` (`sha256Hex`) |

Mécanismes complémentaires de protection de l'application :

- **bcrypt** (12 rounds) pour le hachage des mots de passe de connexion des comptes utilisateurs (jamais stockés en clair).
- **JWT** (JSON Web Token, expiration 1h) pour l'authentification des sessions, transmis via l'en-tête `Authorization: Bearer`.
- **Helmet** pour les en-têtes de sécurité HTTP (Content-Security-Policy, anti-clickjacking, etc.).
- **express-rate-limit** pour limiter les tentatives de connexion/inscription (20 requêtes / 15 min / IP), contre les attaques par force brute.
- **Validation stricte des entrées** sur toutes les routes (format des e-mails, format hexadécimal et longueur exacte du sel/IV/empreinte, taille des fichiers).
- **Isolation stricte par utilisateur** : toute requête sur un fichier vérifie `owner_id`, empêchant un utilisateur d'accéder aux fichiers d'un autre.

## 3. Architecture

```
Navigateur (client)                    Serveur (Node.js / Express)              Stockage
────────────────────                   ────────────────────────────             ───────────
1. Sélection du fichier
2. Dérivation de clé (PBKDF2)
3. Chiffrement (AES-GCM)      ──HTTPS──▶  Validation des métadonnées   ──────▶   SQLite (métadonnées,
4. Calcul de l'empreinte                  Authentification (JWT)                 utilisateurs, tokens
   (SHA-256)                              Génération du lien de partage          de partage)
                                                                        ──────▶   Fichier chiffré sur
                                                                                   disque (jamais lu
                                                                                   en clair)

Destinataire (client)
──────────────────────
1. Ouvre le lien de partage
2. Télécharge le fichier chiffré  ◀──HTTPS──  Sert le fichier chiffré,
3. Déchiffre (AES-GCM) avec le                sans authentification
   mot de passe transmis à part               (le lien seul ne suffit
4. Vérifie l'empreinte (SHA-256)              pas sans le mot de passe)
```

**Stack technique** :
- Frontend : HTML / CSS / JavaScript (vanilla), API Web Crypto native du navigateur — aucune bibliothèque cryptographique tierce
- Backend : Node.js, Express
- Base de données : SQLite (`better-sqlite3`)
- Authentification : bcrypt + JWT
- Déploiement : Render (service web gratuit)

## 4. Installation en local

Prérequis : Node.js 18 ou supérieur.

```bash
git clone https://github.com/desmy-hack/Protocole_security.git
cd Protocole_security
npm install
```

Créez un fichier `.env` à la racine :

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "JWT_SECRET=$JWT_SECRET" > .env
echo "PORT=3000" >> .env
```

Lancez le serveur :

```bash
npm start
```

Ouvrez `http://localhost:3000`.

## 5. Déploiement

Déployé sur **Render** (plan gratuit, aucune carte bancaire requise) :

- **Build command** : `npm install`
- **Start command** : `npm start`
- **Variable d'environnement à configurer** : `JWT_SECRET` (valeur aléatoire générée localement, jamais commitée dans le dépôt)
- Render fournit automatiquement la variable `PORT` et le certificat HTTPS/TLS

## 6. Tests

Une suite de tests automatisés est fournie dans `tests/security.test.js` et couvre :

- Validation à l'inscription (e-mail invalide, mot de passe trop court, doublon)
- Authentification (mauvais mot de passe, token manquant/invalide/expiré)
- Cycle complet chiffrement → upload → partage → téléchargement anonyme → déchiffrement → vérification d'intégrité
- Isolation entre utilisateurs (un compte ne peut pas accéder aux fichiers d'un autre)
- Robustesse (route inconnue, JSON malformé, token de partage mal formé)
- Invalidation du lien de partage après suppression du fichier
- Protection contre le brute-force (rate limiting)

Pour lancer les tests, le serveur doit tourner dans un terminal (`npm start`), puis dans un second terminal :

```bash
node tests/security.test.js
```

**Résultat obtenu** : 28 vérifications, 28 réussies.

## 7. Sécurité, éthique et limites

**Bonnes pratiques suivies** :
- Aucune donnée réelle utilisée : uniquement des fichiers de test synthétiques
- Tous les tests d'attaque (force brute, altération de fichier, accès non autorisé) ont été menés uniquement contre notre propre application
- Aucun secret dans le code source : `JWT_SECRET` est fourni via variable d'environnement, exclu de Git via `.gitignore`
- Dépendances utilisées : Express, better-sqlite3, bcrypt, jsonwebtoken, multer, helmet, express-rate-limit, dotenv (toutes citées dans `package.json`)

**Limites connues, assumées** :
- **Stockage éphémère sur le plan gratuit de Render** : la base de données SQLite et les fichiers chiffrés stockés sur disque sont réinitialisés à chaque redéploiement ou après une période d'inactivité prolongée (mise en veille du service). Un disque persistant réglerait ce point, mais nécessite un plan payant. Pour la démonstration, un compte et un fichier de test sont créés juste avant la remise.
- Le jeton de session (JWT) est stocké côté client dans `sessionStorage`, ce qui reste théoriquement exposé en cas de faille XSS sur le site — un cookie `httpOnly` serait plus robuste, mais demanderait de revoir le mécanisme d'authentification actuel.
- Pas d'authentification à deux facteurs (2FA).
- Pas de limite de nombre de téléchargements ni de date d'expiration sur les liens de partage (un lien reste valide tant que le fichier n'est pas supprimé par son propriétaire).
- Le nom original du fichier est stocké et transmis en clair dans les métadonnées du partage (seul le contenu est chiffré) : un observateur du lien de partage peut voir le nom du fichier avant de le déchiffrer.

## 8. Vérification avant remise

- [ ] Créer un compte de démonstration sur l'application déployée
- [ ] Déposer un fichier de démonstration chiffré
- [ ] Tester le lien de partage généré, dans un onglet de navigation privée
- [ ] Vérifier que le dépôt GitHub ne contient aucun secret (`.env`, base de données, fichiers chiffrés)
- [ ] Mettre à jour les identifiants de démonstration dans ce README

