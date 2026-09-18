/*
 * Couche crypto frontend — chiffrement AES-GCM côté client.
 * Tout se passe ici, dans le navigateur. Le serveur ne reçoit jamais
 * le mot de passe ni le contenu en clair du fichier.
 */
function bufToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes.buffer;
}
async function deriveKey(password, saltBytes, iterations = 250000) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
async function sha256Hex(arrayBuffer) {
  return bufToHex(await crypto.subtle.digest('SHA-256', arrayBuffer));
}

// Chiffre un fichier. Retourne exactement ce que l'API /api/files attend:
// ciphertext (binaire) + salt/iv/sha256Hash en hexadécimal.
async function encryptFile(fileArrayBuffer, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileArrayBuffer);
  const sha256Hash = await sha256Hex(fileArrayBuffer); // empreinte du fichier ORIGINAL
  return { ciphertext, salt: bufToHex(salt), iv: bufToHex(iv), sha256Hash };
}

// Déchiffre et vérifie l'intégrité. Lève une erreur si mot de passe faux
// (AES-GCM refuse) ou si le hash ne correspond pas.
async function decryptFile(ciphertextArrayBuffer, password, saltHex, ivHex, expectedHashHex) {
  const salt = new Uint8Array(hexToBuf(saltHex));
  const iv = new Uint8Array(hexToBuf(ivHex));
  const key = await deriveKey(password, salt);

  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextArrayBuffer);
  } catch (err) {
    throw new Error('Mot de passe incorrect, ou fichier corrompu.');
  }

  const actualHash = await sha256Hex(plaintext);
  if (actualHash !== expectedHashHex.toLowerCase()) {
    throw new Error('Le fichier déchiffré ne correspond pas à son empreinte attendue.');
  }
  return plaintext;
}
