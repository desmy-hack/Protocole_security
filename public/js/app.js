const state = { user: null, files: [] };

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function showAuth(mode = "login") {
  $("#auth-view").classList.remove("hidden");
  $("#app-view").classList.add("hidden");
  $$(".auth-tab").forEach(b => b.classList.toggle("active", b.dataset.auth === mode));
  $("#login-form").classList.toggle("hidden", mode !== "login");
  $("#register-form").classList.toggle("hidden", mode !== "register");
}

function showApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  return `${(bytes / 1024).toFixed(1)} Ko`;
}

function formatDate(iso) {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

// --- Rendu du tableau de fichiers (réutilisé par "Vue d'ensemble" et "Mes fichiers") ---
function renderFilesTable() {
  if (!state.files.length) {
    return `<div class="empty"><div class="empty-icon">▣</div><strong>Aucun fichier</strong><p>Votre coffre-fort est prêt à recevoir votre premier fichier.</p><button class="action-btn" onclick="openUploadModal()">Ajouter un fichier</button></div>`;
  }
  const rows = state.files.map(f => `
    <tr data-file-id="${f.id}">
      <td>
        <div class="file-name">▣ ${escapeHtml(f.original_name)}</div>
        <div class="file-meta">déposé le ${formatDate(f.created_at)}</div>
      </td>
      <td><span class="status">Chiffré</span></td>
      <td>${formatSize(f.size_bytes)}</td>
      <td>
        <button class="icon-btn copy-link-btn" title="Copier le lien de partage" data-token="${f.share_token}">🔗</button>
        <button class="icon-btn delete-file-btn" title="Supprimer" data-id="${f.id}" data-name="${escapeHtml(f.original_name)}">🗑</button>
      </td>
    </tr>`).join("");
  return `<div class="table-wrap"><table class="file-table"><thead><tr><th>Nom</th><th>Statut</th><th>Taille</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// Attache les actions (copier / supprimer) sur le tableau actuellement affiché.
// Nécessaire à chaque fois qu'on réinjecte le HTML avec innerHTML.
function bindFileActions() {
  $$(".copy-link-btn").forEach(btn => btn.onclick = () => {
    const url = FileService.shareUrl(btn.dataset.token);
    navigator.clipboard.writeText(url);
    toast("Lien de partage copié.", "success");
  });
  $$(".delete-file-btn").forEach(btn => btn.onclick = async () => {
    if (!confirm(`Supprimer « ${btn.dataset.name} » ? Cette action est définitive.`)) return;
    try {
      await FileService.remove(btn.dataset.id);
      toast("Fichier supprimé.", "success");
      await loadFiles();
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

function renderDashboard() {
  const email = state.user?.email || "Utilisateur";
  const initial = email[0]?.toUpperCase() || "U";
  $("#user-email").textContent = email;
  $("#avatar").textContent = initial;

  $("#page-content").innerHTML = `
    <div class="content-head">
      <div><span class="eyebrow">ESPACE PRIVÉ</span><h2>Votre coffre-fort</h2></div>
      <button class="action-btn" id="add-file-btn">+ Ajouter un fichier</button>
    </div>
    <div class="stats">
      <div class="stat-card"><div class="stat-label">FICHIERS</div><div class="stat-value">${state.files.length}</div><div class="stat-foot">dans votre coffre</div></div>
      <div class="stat-card"><div class="stat-label">CHIFFREMENT</div><div class="stat-value">AES-256</div><div class="stat-foot">côté client, GCM</div></div>
      <div class="stat-card"><div class="stat-label">LIENS ACTIFS</div><div class="stat-value">${state.files.length}</div><div class="stat-foot">un lien par fichier</div></div>
      <div class="stat-card"><div class="stat-label">SESSION</div><div class="stat-value">✓</div><div class="stat-foot">authentifiée (JWT)</div></div>
    </div>
    <div class="grid-2">
      <section class="panel">
        <div class="panel-title"><h3>Fichiers récents</h3><button class="icon-btn" id="refresh-files" title="Actualiser">↻</button></div>
        <div id="files-area">${renderFilesTable()}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>Activité</h3></div>
        <div class="activity">
          <div class="activity-item"><span class="activity-dot"></span><div><strong>Session ouverte</strong><small>Utilisateur authentifié</small></div></div>
          <div class="activity-item"><span class="activity-dot"></span><div><strong>Chiffrement actif</strong><small>Tout fichier déposé est chiffré avant envoi</small></div></div>
        </div>
      </section>
    </div>`;
  $("#add-file-btn").onclick = openUploadModal;
  $("#refresh-files").onclick = loadFiles;
  bindFileActions();
}

async function loadFiles() {
  try {
    state.files = await FileService.list();
  } catch (err) {
    toast(err.message, "error");
    state.files = [];
  }
  const active = $(".nav-item.active")?.dataset.page || "dashboard";
  if (active === "dashboard") renderDashboard();
  if (active === "files" || active === "shared") setPage(active);
}

function setPage(page) {
  const titles = { dashboard: ["COFFRE-FORT", "Vue d’ensemble"], files: ["FICHIERS", "Mes fichiers"], shared: ["PARTAGE", "Liens de partage"], settings: ["COMPTE", "Paramètres"] };
  $("#page-eyebrow").textContent = titles[page][0];
  $("#page-title").textContent = titles[page][1];
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));

  if (page === "dashboard") renderDashboard();

  if (page === "files") {
    $("#page-content").innerHTML = `<div class="content-head"><div><span class="eyebrow">STOCKAGE</span><h2>Mes fichiers</h2></div><button class="action-btn" id="add-file-btn">+ Ajouter un fichier</button></div><section class="panel"><div id="files-area">${renderFilesTable()}</div></section>`;
    $("#add-file-btn").onclick = openUploadModal;
    bindFileActions();
  }

  if (page === "shared") {
    // Chaque fichier déposé a son propre lien de partage individuel:
    // cette vue réutilise donc le même tableau, avec le lien mis en avant.
    $("#page-content").innerHTML = `<section class="panel"><span class="eyebrow">PARTAGE SÉCURISÉ</span><h2>Liens de partage</h2><p class="muted">Chaque fichier possède son propre lien. Cliquez sur 🔗 pour copier celui d'un fichier.</p><div id="files-area">${renderFilesTable()}</div></section>`;
    bindFileActions();
  }

  if (page === "settings") {
    $("#page-content").innerHTML = `<section class="panel"><span class="eyebrow">COMPTE</span><h2>Paramètres</h2><p class="muted">Compte : ${escapeHtml(state.user?.email || "")}</p><hr style="border-color:var(--border);border-width:1px 0 0;margin:25px 0"><h3>Sécurité</h3><p class="muted">Le changement de mot de passe n'est pas encore disponible dans cette version.</p></section>`;
  }
}

function openUploadModal() {
  $("#upload-modal").classList.remove("hidden");
  $("#file-input").value = "";
  $("#upload-password").value = "";
  $("#selected-file").classList.add("hidden");
  $("#upload-btn").disabled = true;
  refreshUploadButtonState();
}

function closeUploadModal() { $("#upload-modal").classList.add("hidden"); }

function refreshUploadButtonState() {
  const hasFile = $("#file-input").files.length > 0;
  const hasPassword = $("#upload-password").value.length >= 8;
  $("#upload-btn").disabled = !(hasFile && hasPassword);
}

async function uploadSelectedFile() {
  const file = $("#file-input").files[0];
  const password = $("#upload-password").value;
  if (!file) return;
  if (password.length < 8) return toast("Le mot de passe doit contenir au moins 8 caractères.", "error");
  if (file.size > 50 * 1024 * 1024) return toast("Le fichier dépasse la limite de 50 MB.", "error");

  $("#upload-progress").classList.remove("hidden");
  $("#upload-btn").disabled = true;

  try {
    await FileService.upload(file, password, (pct, label) => {
      $("#progress-bar").style.width = pct + "%";
      $("#progress-value").textContent = pct + "%";
      $("#progress-label").textContent = label;
    });
    toast("Fichier chiffré et déposé avec succès.", "success");
    setTimeout(closeUploadModal, 450);
    await loadFiles();
  } catch (e) {
    toast(e.message, "error");
    $("#upload-btn").disabled = false;
  }
}

function setup() {
  $$(".auth-tab").forEach(btn => btn.onclick = () => showAuth(btn.dataset.auth));
  $$(".password-toggle").forEach(btn => btn.onclick = () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === "password" ? "text" : "password";
    btn.textContent = input.type === "password" ? "Afficher" : "Masquer";
  });

  $("#login-form").onsubmit = async e => {
    e.preventDefault();
    try {
      await Auth.login($("#login-email").value.trim(), $("#login-password").value);
      state.user = await Auth.me();
      showApp();
      await loadFiles();
      toast("Connexion réussie.", "success");
    } catch (err) { toast(err.message, "error"); }
  };

  $("#register-form").onsubmit = async e => {
    e.preventDefault();
    try {
      await Auth.register($("#register-email").value.trim(), $("#register-password").value);
      toast("Compte créé. Vous pouvez maintenant vous connecter.", "success");
      showAuth("login");
      $("#login-email").value = $("#register-email").value.trim();
    } catch (err) { toast(err.message, "error"); }
  };

  $("#register-password").oninput = e => {
    const n = e.target.value.length, bar = $("#password-meter-bar"), hint = $("#password-hint");
    const pct = Math.min(100, n * 10);
    bar.style.width = pct + "%";
    if (n < 8) { hint.textContent = "8 caractères minimum."; bar.style.background = "var(--danger)"; }
    else if (n < 12) { hint.textContent = "Mot de passe acceptable."; bar.style.background = "#f3c969"; }
    else { hint.textContent = "Mot de passe robuste."; bar.style.background = "var(--success)"; }
  };

  $$(".nav-item").forEach(btn => btn.onclick = () => setPage(btn.dataset.page));
  $("#logout-btn").onclick = () => { Auth.logout(); state.user = null; showAuth("login"); toast("Session fermée."); };
  $("#menu-btn").onclick = () => $("#sidebar").classList.toggle("open");
  $$("[data-close-modal]").forEach(el => el.onclick = closeUploadModal);
  $("#dropzone").onclick = () => $("#file-input").click();
  $("#file-input").onchange = () => {
    const file = $("#file-input").files[0];
    if (!file) return;
    $("#selected-file").textContent = `${file.name} — ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    $("#selected-file").classList.remove("hidden");
    refreshUploadButtonState();
  };
  $("#upload-password").oninput = refreshUploadButtonState;
  $("#upload-btn").onclick = uploadSelectedFile;

  $("#dropzone").ondragover = e => { e.preventDefault(); $("#dropzone").style.borderColor = "var(--accent)"; };
  $("#dropzone").ondragleave = () => $("#dropzone").style.borderColor = "";
  $("#dropzone").ondrop = e => {
    e.preventDefault(); $("#dropzone").style.borderColor = "";
    const file = e.dataTransfer.files[0]; if (!file) return;
    const dt = new DataTransfer(); dt.items.add(file); $("#file-input").files = dt.files;
    $("#file-input").dispatchEvent(new Event("change"));
  };
}

(async function init() {
  setup();
  if (sessionStorage.getItem("accessToken")) {
    try {
      state.user = await Auth.me();
      showApp();
      await loadFiles();
    } catch { Auth.logout(); showAuth("login"); }
  } else showAuth("login");
})();
