const token = location.hash.slice(1);

const loadingState = document.getElementById('loading-state');
const invalidState = document.getElementById('invalid-state');
const downloadState = document.getElementById('download-state');

let meta = null;

(async function init() {
  if (!token) return showInvalid('Aucun lien de partage fourni.');
  try {
    const res = await fetch(`/api/share/${token}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lien invalide.');
    meta = data;
    document.getElementById('file-name').textContent = meta.originalName;
    document.getElementById('file-meta').textContent = `${(meta.size / 1024).toFixed(1)} Ko (chiffré)`;
    loadingState.classList.add('hidden');
    downloadState.classList.remove('hidden');
  } catch (err) {
    showInvalid(err.message);
  }
})();

function showInvalid(text) {
  loadingState.classList.add('hidden');
  document.getElementById('invalid-msg').textContent = text;
  invalidState.classList.remove('hidden');
}

document.querySelector('.password-toggle').addEventListener('click', (e) => {
  const input = document.getElementById(e.target.dataset.target);
  input.type = input.type === 'password' ? 'text' : 'password';
  e.target.textContent = input.type === 'password' ? 'Afficher' : 'Masquer';
});

document.getElementById('download-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dlMsg = document.getElementById('dl-msg');
  const submitBtn = document.getElementById('dl-submit');
  dlMsg.innerHTML = '';

  const password = document.getElementById('dl-password').value;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Téléchargement du fichier chiffré…';

    const res = await fetch(meta.downloadUrl);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error((data && data.error) || 'Échec du téléchargement.');
    }
    const ciphertext = await res.arrayBuffer();

    submitBtn.textContent = 'Déchiffrement en cours…';
    const plaintext = await decryptFile(ciphertext, password, meta.salt, meta.iv, meta.sha256Hash);

    const blob = new Blob([plaintext]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    dlMsg.innerHTML = '<div class="share-msg success">Fichier déchiffré et téléchargé avec succès.</div>';
  } catch (err) {
    dlMsg.innerHTML = `<div class="share-msg error">${err.message}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Déchiffrer et télécharger';
  }
});
