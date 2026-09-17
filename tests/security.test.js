// Suite de tests de sécurité pour le coffre-fort de fichiers.
//
// Prérequis: le serveur doit tourner (node server/index.js) dans un
// terminal séparé avant de lancer ce script.
//
// Lancement: node tests/security.test.js

const path = require('path');
const jwt = require('jsonwebtoken');
const config = require(path.join(__dirname, '..', 'server', 'config'));

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function check(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${description}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

function bufToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes.buffer;
}
async function deriveKey(password, saltBytes) {
  const passwordKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 250000, hash: 'SHA-256' },
    passwordKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
async function sha256Hex(buf) { return bufToHex(await crypto.subtle.digest('SHA-256', buf)); }

async function registerAndLogin(email, password) {
  await fetch(`${BASE}/api/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.token;
}

async function main() {
  const stamp = Date.now();

  section('1. Validation à l\'inscription');
  let r = await fetch(`${BASE}/api/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pas-un-email', password: 'motdepassesolide123' }),
  });
  check('E-mail mal formé rejeté (400)', r.status === 400);

  r = await fetch(`${BASE}/api/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `valid_${stamp}@example.com`, password: 'court' }),
  });
  check('Mot de passe trop court rejeté (400)', r.status === 400);

  const email = `test_${stamp}@example.com`;
  const password = 'motdepasseTresSolide123';
  r = await fetch(`${BASE}/api/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  check('Inscription valide acceptée (201)', r.status === 201);

  r = await fetch(`${BASE}/api/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  check('E-mail déjà utilisé rejeté (409)', r.status === 409);

  section('2. Authentification');
  r = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'mauvais_mot_de_passe' }),
  });
  check('Mauvais mot de passe rejeté (401)', r.status === 401);

  r = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await r.json();
  check('Bon mot de passe accepté (200) avec un token', r.status === 200 && !!loginBody.token);
  const token = loginBody.token;

  r = await fetch(`${BASE}/api/files`);
  check('Route protégée refusée sans token (401)', r.status === 401);

  r = await fetch(`${BASE}/api/files`, { headers: { Authorization: `Bearer ${token}` } });
  check('Route protégée acceptée avec un token valide (200)', r.status === 200);

  r = await fetch(`${BASE}/api/files`, { headers: { Authorization: 'Bearer un.faux.token' } });
  check('Token invalide (falsifié) rejeté (401)', r.status === 401);

  section('3. Expiration du JWT');
  const shortLivedToken = jwt.sign({ userId: 1, email }, config.jwtSecret, { expiresIn: '1s' });
  r = await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${shortLivedToken}` } });
  check('Token frais accepté avant expiration (200)', r.status === 200);
  await new Promise((res) => setTimeout(res, 1500));
  r = await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${shortLivedToken}` } });
  check('Même token rejeté après expiration (401)', r.status === 401);

  section('4. Cycle complet: chiffrement, upload, partage, déchiffrement');
  const originalText = 'Fichier confidentiel de test de sécurité.';
  const originalBuf = new TextEncoder().encode(originalText).buffer;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, originalBuf);
  const sha256Hash = await sha256Hex(originalBuf);

  const form = new FormData();
  form.append('file', new Blob([ciphertext]), 'encrypted.bin');
  form.append('salt', bufToHex(salt));
  form.append('iv', bufToHex(iv));
  form.append('sha256Hash', sha256Hash);
  form.append('originalName', 'secret.txt');
  r = await fetch(`${BASE}/api/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const uploadBody = await r.json();
  check('Upload du fichier chiffré accepté (201)', r.status === 201);
  const { fileId, shareToken } = uploadBody;

  r = await fetch(`${BASE}/api/share/${shareToken}`);
  const shareMeta = await r.json();
  check('Métadonnées de partage accessibles sans authentification (200)', r.status === 200);

  r = await fetch(`${BASE}${shareMeta.downloadUrl}`);
  const downloadedCipher = await r.arrayBuffer();
  check('Téléchargement anonyme du blob chiffré réussi (200)', r.status === 200 && downloadedCipher.byteLength > 0);

  const key2 = await deriveKey(password, new Uint8Array(hexToBuf(shareMeta.salt)));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(hexToBuf(shareMeta.iv)) }, key2, downloadedCipher);
  const decoded = new TextDecoder().decode(plaintext);
  check('Déchiffrement correct, texte identique à l\'original', decoded === originalText);

  const actualHash = await sha256Hex(plaintext);
  check('Intégrité SHA-256 vérifiée après déchiffrement', actualHash === shareMeta.sha256Hash);

  try {
    const wrongKey = await deriveKey('mauvais_mot_de_passe_xyz', new Uint8Array(hexToBuf(shareMeta.salt)));
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(hexToBuf(shareMeta.iv)) }, wrongKey, downloadedCipher);
    check('Mauvais mot de passe rejeté par AES-GCM', false);
  } catch {
    check('Mauvais mot de passe rejeté par AES-GCM', true);
  }

  section('5. Isolation entre utilisateurs');
  const token2 = await registerAndLogin(`autre_${stamp}@example.com`, password);
  r = await fetch(`${BASE}/api/files/${fileId}/metadata`, { headers: { Authorization: `Bearer ${token2}` } });
  check('Un autre utilisateur ne peut PAS lire les métadonnées (404)', r.status === 404);

  r = await fetch(`${BASE}/api/files/${fileId}`, { headers: { Authorization: `Bearer ${token2}` } });
  check('Un autre utilisateur ne peut PAS télécharger le fichier (404)', r.status === 404);

  r = await fetch(`${BASE}/api/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token2}` } });
  check('Un autre utilisateur ne peut PAS supprimer le fichier (404)', r.status === 404);

  section('6. Robustesse générale');
  r = await fetch(`${BASE}/api/share/abc`);
  check('Token de partage mal formé rejeté (404), sans requête BDD', r.status === 404);

  r = await fetch(`${BASE}/api/route-qui-nexiste-pas`);
  check('Route inconnue renvoie un 404 JSON propre', r.status === 404);

  r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{json cassé' });
  check('JSON malformé ne fait pas planter le serveur (500 propre)', r.status === 500);

  r = await fetch(`${BASE}/api/health`);
  check('Le serveur répond toujours après une requête malformée', r.status === 200);

  section('7. Suppression et invalidation du lien de partage');
  r = await fetch(`${BASE}/api/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  check('Le propriétaire peut supprimer son fichier (200)', r.status === 200);

  r = await fetch(`${BASE}/api/share/${shareToken}`);
  check('Le lien de partage est invalide après suppression (404)', r.status === 404);

  section('8. Protection contre le brute-force (rate limiting) — exécuté en dernier');
  console.log('  (envoi de 25 tentatives de connexion rapides...)');
  let firstBlockAt = null;
  let sawSuccessAfterBlock = false;
  for (let i = 1; i <= 25; i++) {
    const res = await fetch(`${BASE}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'personne@example.com', password: 'faux' }),
    });
    if (res.status === 429 && firstBlockAt === null) firstBlockAt = i;
    if (firstBlockAt !== null && res.status !== 429) sawSuccessAfterBlock = true;
  }
  check('Le rate limiting finit par bloquer (429) avant la 25e tentative', firstBlockAt !== null);
  check('Une fois bloqué, ça reste bloqué (pas de retour à 401 entre-temps)', !sawSuccessAfterBlock);
  if (firstBlockAt) console.log(`  ℹ️  Blocage déclenché à la tentative n°${firstBlockAt} de cette boucle`);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`RÉSULTAT: ${passed} réussi(s), ${failed} échoué(s)`);
  console.log('='.repeat(50));
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n💥 Erreur inattendue pendant les tests:', err);
  process.exit(1);
});
