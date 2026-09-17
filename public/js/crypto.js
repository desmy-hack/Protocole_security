// Convertit des octets bruts en texte hexadécimal (pour stockage/transport)
function bufToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Fait l'inverse: texte hexadécimal -> octets bruts
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

async function deriveKey(password, saltBytes) {
  const passwordKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 250000, hash: 'SHA-256' },
    passwordKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return bufToHex(digest);
}

// Chiffre un fichier. Retourne tout ce qu'il faudra envoyer au serveur.
async function encryptFile(fileArrayBuffer, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileArrayBuffer);
  const sha256Hash = await sha256Hex(fileArrayBuffer); // empreinte du fichier ORIGINAL

  return {
    ciphertext,
    salt: bufToHex(salt),
    iv: bufToHex(iv),
    sha256Hash,
  };
}

// Déchiffre et vérifie l'intégrité. Lève une erreur si mot de passe faux
// (AES-GCM refuse) ou si le hash ne correspond pas (fichier altéré autrement).
async function decryptFile(ciphertextArrayBuffer, password, saltHex, ivHex, expectedHashHex) {
  const salt = new Uint8Array(hexToBuf(saltHex));
  const iv = new Uint8Array(hexToBuf(ivHex));
  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextArrayBuffer);

  const actualHash = await sha256Hex(plaintext);
  if (actualHash !== expectedHashHex.toLowerCase()) {
    throw new Error('Le fichier ne correspond pas à son empreinte attendue.');
  }

  return plaintext;
}
