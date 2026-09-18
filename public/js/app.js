const state = {
  user: null,
  files: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function toast(message, type = "info") {
  const element = document.createElement("div");

  element.className = `toast ${type}`;
  element.textContent = message;

  const container = $("#toast-container");

  if (!container) {
    return;
  }

  container.appendChild(element);

  setTimeout(() => {
    element.remove();
  }, 3800);
}

function showAuth(mode = "login") {
  $("#auth-view").classList.remove("hidden");
  $("#app-view").classList.add("hidden");

  $$(".auth-tab").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.auth === mode
    );
  });

  $("#login-form").classList.toggle(
    "hidden",
    mode !== "login"
  );

  $("#register-form").classList.toggle(
    "hidden",
    mode !== "register"
  );
}

function showApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character])
  );
}

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} o`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso) {
  if (!iso) {
    return "Date inconnue";
  }

  return new Date(
    iso.replace(" ", "T") + "Z"
  ).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function renderFilesTable() {
  if (!state.files.length) {
    return `
      <div class="empty">
        <div class="empty-icon">
          <span class="empty-file-shape"></span>
        </div>

        <strong>Aucun fichier</strong>

        <p>
          Votre coffre-fort est prêt à recevoir
          votre premier fichier.
        </p>

        <button
          class="action-btn"
          id="empty-upload-btn"
          type="button"
        >
          <span class="btn-plus">+</span>
          <span>Ajouter un fichier</span>
        </button>
      </div>
    `;
  }

  const rows = state.files.map((file, index) => `
    <tr
      data-file-id="${file.id}"
      style="--row-delay: ${index * 55}ms"
      class="file-row-enter"
    >
      <td>
        <div class="file-cell">

          <div class="file-type-icon">
            <span class="file-icon-shape"></span>
          </div>

          <div class="file-info">

            <div
              class="file-name"
              title="${escapeHtml(file.original_name)}"
            >
              ${escapeHtml(file.original_name)}
            </div>

            <div class="file-meta">
              Déposé le ${formatDate(file.created_at)}
            </div>

          </div>

        </div>
      </td>

      <td>
        <span class="status">
          <span class="status-dot"></span>
          Chiffré
        </span>
      </td>

      <td>
        <span class="file-size">
          ${formatSize(file.size_bytes)}
        </span>
      </td>

      <td>
        <div class="file-actions">

          <button
            class="icon-btn copy-link-btn"
            type="button"
            title="Copier le lien de partage"
            aria-label="Copier le lien de partage"
            data-token="${escapeHtml(file.share_token)}"
          >
            <span class="share-icon"></span>
          </button>

          <button
            class="icon-btn delete-file-btn danger-btn"
            type="button"
            title="Supprimer"
            aria-label="Supprimer"
            data-id="${file.id}"
            data-name="${escapeHtml(file.original_name)}"
          >
            <span class="delete-icon"></span>
          </button>

        </div>
      </td>
    </tr>
  `).join("");

  return `
    <div class="table-wrap">

      <table class="file-table">

        <thead>
          <tr>
            <th>FICHIER</th>
            <th>STATUT</th>
            <th>TAILLE</th>
            <th>ACTIONS</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>

    </div>
  `;
}

function bindFileActions() {
  $$(".copy-link-btn").forEach((button) => {
    button.onclick = async () => {
      try {
        const url = FileService.shareUrl(
          button.dataset.token
        );

        await navigator.clipboard.writeText(url);

        button.classList.add("copied");

        setTimeout(() => {
          button.classList.remove("copied");
        }, 700);

        toast(
          "Lien de partage copié.",
          "success"
        );

      } catch (error) {
        toast(
          "Impossible de copier le lien.",
          "error"
        );
      }
    };
  });

  $$(".delete-file-btn").forEach((button) => {
    button.onclick = async () => {
      const fileName = button.dataset.name;

      if (
        !confirm(
          `Supprimer « ${fileName} » ? Cette action est définitive.`
        )
      ) {
        return;
      }

      try {
        await FileService.remove(
          button.dataset.id
        );

        toast(
          "Fichier supprimé.",
          "success"
        );

        await loadFiles();

      } catch (error) {
        toast(
          error.message,
          "error"
        );
      }
    };
  });

  const emptyUploadButton =
    $("#empty-upload-btn");

  if (emptyUploadButton) {
    emptyUploadButton.onclick =
      openUploadModal;
  }
}

function renderDashboard() {
  const email =
    state.user?.email || "Utilisateur";

  const initial =
    email[0]?.toUpperCase() || "U";

  $("#user-email").textContent = email;
  $("#avatar").textContent = initial;

  $("#page-content").innerHTML = `
    <div class="dashboard-header">

      <div class="dashboard-heading">
        <span class="eyebrow">
          ESPACE PRIVÉ
        </span>

        <h2>
          Votre coffre-fort
        </h2>

        <p>
          Gérez vos fichiers chiffrés
          en toute sécurité.
        </p>
      </div>

      <button
        class="action-btn dashboard-add-btn"
        id="add-file-btn"
        type="button"
      >
        <span class="btn-plus">+</span>
        <span>Ajouter un fichier</span>
      </button>

    </div>

    <div class="stats">

      <div
        class="stat-card stat-card-enter"
        style="--card-delay: 0ms"
      >
        <div class="stat-icon-wrap files-icon">
          <span class="stat-icon file-icon-shape"></span>
        </div>

        <div class="stat-content">
          <span class="stat-label">
            FICHIERS
          </span>

          <div class="stat-value">
            ${state.files.length}
          </div>

          <span class="stat-foot">
            dans votre coffre
          </span>
        </div>
      </div>

      <div
        class="stat-card stat-card-enter"
        style="--card-delay: 80ms"
      >
        <div class="stat-icon-wrap security-icon">
          <span class="stat-icon shield-icon"></span>
        </div>

        <div class="stat-content">
          <span class="stat-label">
            CHIFFREMENT
          </span>

          <div class="stat-value stat-text">
            AES-256
          </div>

          <span class="stat-foot">
            côté client · GCM
          </span>
        </div>
      </div>

      <div
        class="stat-card stat-card-enter"
        style="--card-delay: 160ms"
      >
        <div class="stat-icon-wrap links-icon">
          <span class="stat-icon share-icon"></span>
        </div>

        <div class="stat-content">
          <span class="stat-label">
            LIENS ACTIFS
          </span>

          <div class="stat-value">
            ${state.files.length}
          </div>

          <span class="stat-foot">
            un lien par fichier
          </span>
        </div>
      </div>

      <div
        class="stat-card stat-card-enter"
        style="--card-delay: 240ms"
      >
        <div class="stat-icon-wrap session-icon">
          <span class="stat-icon check-icon"></span>
        </div>

        <div class="stat-content">
          <span class="stat-label">
            SESSION
          </span>

          <div class="stat-value">
            1
          </div>

          <span class="stat-foot">
            authentifiée · JWT
          </span>
        </div>
      </div>

    </div>

    <div class="dashboard-grid">

      <section class="panel files-panel">

        <div class="panel-title">

          <div>
            <span class="panel-kicker">
              STOCKAGE
            </span>

            <h3>
              Fichiers récents
            </h3>
          </div>

          <button
            class="icon-btn refresh-btn"
            id="refresh-files"
            type="button"
            title="Actualiser"
            aria-label="Actualiser"
          >
            <span class="refresh-icon"></span>
          </button>

        </div>

        <div id="files-area">
          ${renderFilesTable()}
        </div>

      </section>

      <section class="panel activity-panel">

        <div class="panel-title">

          <div>
            <span class="panel-kicker">
              SÉCURITÉ
            </span>

            <h3>
              Activité
            </h3>
          </div>

          <span class="live-indicator">
            <span class="live-dot"></span>
            ACTIF
          </span>

        </div>

        <div class="activity">

          <div
            class="activity-item activity-enter"
            style="--activity-delay: 0ms"
          >
            <div class="activity-icon">
              <span class="check-icon"></span>
            </div>

            <div class="activity-text">
              <strong>
                Session ouverte
              </strong>

              <small>
                Utilisateur authentifié
              </small>
            </div>
          </div>

          <div
            class="activity-item activity-enter"
            style="--activity-delay: 100ms"
          >
            <div class="activity-icon">
              <span class="shield-icon"></span>
            </div>

            <div class="activity-text">
              <strong>
                Chiffrement actif
              </strong>

              <small>
                Les fichiers sont chiffrés
                avant leur envoi
              </small>
            </div>
          </div>

          <div
            class="activity-item activity-enter"
            style="--activity-delay: 200ms"
          >
            <div class="activity-icon">
              <span class="lock-icon"></span>
            </div>

            <div class="activity-text">
              <strong>
                Coffre sécurisé
              </strong>

              <small>
                Protection AES-GCM active
              </small>
            </div>
          </div>

        </div>

      </section>

    </div>
  `;

  const addButton =
    $("#add-file-btn");

  if (addButton) {
    addButton.onclick =
      openUploadModal;
  }

  const refreshButton =
    $("#refresh-files");

  if (refreshButton) {
    refreshButton.onclick =
      loadFiles;
  }

  bindFileActions();
  animateDashboard();
}

async function loadFiles() {
  try {
    state.files =
      await FileService.list();

  } catch (error) {
    toast(
      error.message,
      "error"
    );

    state.files = [];
  }

  const activePage =
    $(".nav-item.active")?.dataset.page ||
    "dashboard";

  if (activePage === "dashboard") {
    renderDashboard();
  }

  if (
    activePage === "files" ||
    activePage === "shared"
  ) {
    setPage(activePage);
  }
}

function setPage(page) {
  const titles = {
    dashboard: [
      "COFFRE-FORT",
      "Vue d’ensemble"
    ],

    files: [
      "FICHIERS",
      "Mes fichiers"
    ],

    shared: [
      "PARTAGE",
      "Liens de partage"
    ],

    settings: [
      "COMPTE",
      "Paramètres"
    ]
  };

  if (!titles[page]) {
    return;
  }

  $("#page-eyebrow").textContent =
    titles[page][0];

  $("#page-title").textContent =
    titles[page][1];

  $$(".nav-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  if (page === "dashboard") {
    renderDashboard();
    return;
  }

  if (page === "files") {
    $("#page-content").innerHTML = `
      <div class="dashboard-header">

        <div class="dashboard-heading">
          <span class="eyebrow">
            STOCKAGE
          </span>

          <h2>
            Mes fichiers
          </h2>

          <p>
            Tous vos fichiers chiffrés
            sont regroupés ici.
          </p>
        </div>

        <button
          class="action-btn dashboard-add-btn"
          id="add-file-btn"
          type="button"
        >
          <span class="btn-plus">+</span>
          <span>Ajouter un fichier</span>
        </button>

      </div>

      <section class="panel files-panel">

        <div class="panel-title">

          <div>
            <span class="panel-kicker">
              VOS DONNÉES
            </span>

            <h3>
              Tous les fichiers
            </h3>
          </div>

          <span class="share-count">
            ${state.files.length}
            fichier${state.files.length > 1 ? "s" : ""}
          </span>

        </div>

        <div id="files-area">
          ${renderFilesTable()}
        </div>

      </section>
    `;

    $("#add-file-btn").onclick =
      openUploadModal;

    bindFileActions();
    animatePageContent();

    return;
  }

  if (page === "shared") {
    $("#page-content").innerHTML = `
      <div class="dashboard-header">

        <div class="dashboard-heading">
          <span class="eyebrow">
            PARTAGE SÉCURISÉ
          </span>

          <h2>
            Liens de partage
          </h2>

          <p>
            Partagez vos fichiers grâce
            à des liens sécurisés.
          </p>
        </div>

      </div>

      <section class="panel files-panel">

        <div class="panel-title">

          <div>
            <span class="panel-kicker">
              LIENS
            </span>

            <h3>
              Vos fichiers partagés
            </h3>
          </div>

          <span class="share-count">
            ${state.files.length}
            fichier${state.files.length > 1 ? "s" : ""}
          </span>

        </div>

        <p class="panel-description">
          Chaque fichier possède son propre
          lien de partage. Utilisez le bouton
          de partage pour copier le lien.
        </p>

        <div id="files-area">
          ${renderFilesTable()}
        </div>

      </section>
    `;

    bindFileActions();
    animatePageContent();

    return;
  }

  if (page === "settings") {
    $("#page-content").innerHTML = `
      <div class="dashboard-header">

        <div class="dashboard-heading">
          <span class="eyebrow">
            COMPTE
          </span>

          <h2>
            Paramètres
          </h2>

          <p>
            Gérez les informations
            de votre compte.
          </p>
        </div>

      </div>

      <section class="panel settings-panel">

        <div class="panel-title">

          <div>
            <span class="panel-kicker">
              PROFIL
            </span>

            <h3>
              Informations du compte
            </h3>
          </div>

        </div>

        <div class="setting-row">

          <div class="setting-icon">
            <span class="mail-icon"></span>
          </div>

          <div>
            <strong>
              Adresse e-mail
            </strong>

            <small>
              ${escapeHtml(
                state.user?.email || ""
              )}
            </small>
          </div>

        </div>

        <div class="setting-row">

          <div class="setting-icon">
            <span class="lock-icon"></span>
          </div>

          <div>
            <strong>
              Authentification
            </strong>

            <small>
              Session protégée par JWT
            </small>
          </div>

        </div>

        <div class="setting-row">

          <div class="setting-icon">
            <span class="shield-icon"></span>
          </div>

          <div>
            <strong>
              Sécurité des fichiers
            </strong>

            <small>
              Chiffrement côté client
              avec AES-GCM
            </small>
          </div>

        </div>

        <div class="settings-notice">
          <strong>
            Changement du mot de passe
          </strong>

          <p>
            Cette fonctionnalité n'est pas
            encore disponible dans cette version.
          </p>
        </div>

      </section>
    `;

    animatePageContent();
  }
}

function openUploadModal() {
  const modal = $("#upload-modal");

  if (!modal) {
    return;
  }

  modal.classList.remove("hidden");

  $("#file-input").value = "";
  $("#upload-password").value = "";

  $("#selected-file")
    .classList.add("hidden");

  $("#upload-btn").disabled = true;

  $("#upload-progress")
    .classList.add("hidden");

  $("#progress-bar").style.width = "0%";
  $("#progress-value").textContent = "0%";
  $("#progress-label").textContent =
    "Préparation…";

  refreshUploadButtonState();
}

function closeUploadModal() {
  const modal = $("#upload-modal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
}

function refreshUploadButtonState() {
  const fileInput =
    $("#file-input");

  const passwordInput =
    $("#upload-password");

  const uploadButton =
    $("#upload-btn");

  if (
    !fileInput ||
    !passwordInput ||
    !uploadButton
  ) {
    return;
  }

  const hasFile =
    fileInput.files.length > 0;

  const hasPassword =
    passwordInput.value.length >= 8;

  uploadButton.disabled =
    !(hasFile && hasPassword);
}

async function uploadSelectedFile() {
  const file =
    $("#file-input").files[0];

  const password =
    $("#upload-password").value;

  if (!file) {
    return;
  }

  if (password.length < 8) {
    toast(
      "Le mot de passe doit contenir au moins 8 caractères.",
      "error"
    );

    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    toast(
      "Le fichier dépasse la limite de 50 MB.",
      "error"
    );

    return;
  }

  $("#upload-progress")
    .classList.remove("hidden");

  $("#upload-btn").disabled = true;

  try {
    await FileService.upload(
      file,
      password,
      (percentage, label) => {
        $("#progress-bar").style.width =
          percentage + "%";

        $("#progress-value").textContent =
          percentage + "%";

        $("#progress-label").textContent =
          label;
      }
    );

    toast(
      "Fichier chiffré et déposé avec succès.",
      "success"
    );

    setTimeout(
      closeUploadModal,
      450
    );

    await loadFiles();

  } catch (error) {
    toast(
      error.message,
      "error"
    );

    $("#upload-btn").disabled =
      false;
  }
}

function setup() {
  $$(".auth-tab").forEach((button) => {
    button.onclick = () => {
      showAuth(
        button.dataset.auth
      );
    };
  });

  $$(".password-toggle").forEach((button) => {
    button.onclick = () => {
      const input =
        document.getElementById(
          button.dataset.target
        );

      if (!input) {
        return;
      }

      input.type =
        input.type === "password"
          ? "text"
          : "password";

      button.textContent =
        input.type === "password"
          ? "Afficher"
          : "Masquer";
    };
  });

  $("#login-form").onsubmit =
    async (event) => {
      event.preventDefault();

      const button =
        event.submitter ||
        $("#login-form button[type='submit']");

      if (button) {
        button.classList.add("loading");
        button.disabled = true;
      }

      try {
        await Auth.login(
          $("#login-email").value.trim(),
          $("#login-password").value
        );

        state.user =
          await Auth.me();

        showApp();

        await loadFiles();

        toast(
          "Connexion réussie.",
          "success"
        );

      } catch (error) {
        toast(
          error.message,
          "error"
        );

      } finally {
        if (button) {
          button.classList.remove(
            "loading"
          );

          button.disabled = false;
        }
      }
    };

  $("#register-form").onsubmit =
    async (event) => {
      event.preventDefault();

      try {
        const email =
          $("#register-email")
            .value
            .trim();

        const password =
          $("#register-password")
            .value;

        await Auth.register(
          email,
          password
        );

        toast(
          "Compte créé. Vous pouvez maintenant vous connecter.",
          "success"
        );

        showAuth("login");

        $("#login-email").value =
          email;

      } catch (error) {
        toast(
          error.message,
          "error"
        );
      }
    };

  $("#register-password").oninput =
    (event) => {
      const length =
        event.target.value.length;

      const bar =
        $("#password-meter-bar");

      const hint =
        $("#password-hint");

      const percentage =
        Math.min(
          100,
          length * 10
        );

      bar.style.width =
        percentage + "%";

      if (length < 8) {
        hint.textContent =
          "8 caractères minimum.";

        bar.style.background =
          "var(--danger)";

      } else if (length < 12) {
        hint.textContent =
          "Mot de passe acceptable.";

        bar.style.background =
          "#f3c969";

      } else {
        hint.textContent =
          "Mot de passe robuste.";

        bar.style.background =
          "var(--success)";
      }
    };

  $$(".nav-item").forEach((button) => {
    button.onclick = () => {
      setPage(
        button.dataset.page
      );

      $("#sidebar")
        ?.classList.remove("open");
    };
  });

  $("#logout-btn").onclick = () => {
    Auth.logout();
    state.user = null;
    $("#login-form").reset();
    $("#register-form").reset();
    showAuth("login");
    toast("Session fermée.");
  };

  $("#menu-btn").onclick = () => {
    $("#sidebar")
      .classList.toggle("open");
  };

  $$("[data-close-modal]")
    .forEach((element) => {
      element.onclick =
        closeUploadModal;
    });

  $("#dropzone").onclick = () => {
    $("#file-input").click();
  };

  $("#file-input").onchange = () => {
    const file =
      $("#file-input").files[0];

    if (!file) {
      return;
    }

    $("#selected-file")
      .textContent =
      `${file.name} — ${(file.size / 1024 / 1024).toFixed(2)} MB`;

    $("#selected-file")
      .classList.remove("hidden");

    refreshUploadButtonState();
  };

  $("#upload-password").oninput =
    refreshUploadButtonState;

  $("#upload-btn").onclick =
    uploadSelectedFile;

  $("#dropzone").ondragover =
    (event) => {
      event.preventDefault();

      $("#dropzone")
        .classList.add("drag-over");
    };

  $("#dropzone").ondragleave =
    () => {
      $("#dropzone")
        .classList.remove("drag-over");
    };

  $("#dropzone").ondrop =
    (event) => {
      event.preventDefault();

      $("#dropzone")
        .classList.remove("drag-over");

      const file =
        event.dataTransfer.files[0];

      if (!file) {
        return;
      }

      const dataTransfer =
        new DataTransfer();

      dataTransfer.items.add(file);

      $("#file-input").files =
        dataTransfer.files;

      $("#file-input")
        .dispatchEvent(
          new Event("change")
        );
    };
}

function animatePageContent() {
  const content =
    $("#page-content");

  if (!content) {
    return;
  }

  content.classList.remove(
    "page-enter"
  );

  requestAnimationFrame(() => {
    content.classList.add(
      "page-enter"
    );
  });
}

function animateDashboard() {
  animatePageContent();

  const cards =
    $$(".stat-card");

  cards.forEach((card, index) => {
    card.style.setProperty(
      "--card-delay",
      `${index * 80}ms`
    );

    card.classList.add(
      "stat-card-enter"
    );
  });

  const rows =
    $$(".file-table tbody tr");

  rows.forEach((row, index) => {
    row.style.setProperty(
      "--row-delay",
      `${index * 55}ms`
    );

    row.classList.add(
      "file-row-enter"
    );
  });

  const activities =
    $$(".activity-item");

  activities.forEach((item, index) => {
    item.style.setProperty(
      "--activity-delay",
      `${index * 100}ms`
    );

    item.classList.add(
      "activity-enter"
    );
  });

  animateNumericCounters();
}

function animateNumericCounters() {
  const counters =
    $$(".stat-card .stat-value");

  counters.forEach((counter) => {
    const original =
      counter.textContent.trim();

    if (!/^\d+$/.test(original)) {
      return;
    }

    const target =
      Number(original);

    if (!Number.isFinite(target)) {
      return;
    }

    const duration = 700;
    const start =
      performance.now();

    counter.textContent = "0";

    function update(time) {
      const progress =
        Math.min(
          (time - start) / duration,
          1
        );

      const eased =
        1 - Math.pow(
          1 - progress,
          3
        );

      counter.textContent =
        String(
          Math.round(
            target * eased
          )
        );

      if (progress < 1) {
        requestAnimationFrame(
          update
        );
      }
    }

    requestAnimationFrame(update);
  });
}

document.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        ".action-btn, .primary-btn"
      );

    if (!button) {
      return;
    }

    if (
      button.disabled ||
      button.classList.contains(
        "loading"
      )
    ) {
      return;
    }

    button.classList.add(
      "button-pressed"
    );

    setTimeout(() => {
      button.classList.remove(
        "button-pressed"
      );
    }, 180);
  }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const modal =
      $("#upload-modal");

    if (
      modal &&
      !modal.classList.contains("hidden")
    ) {
      closeUploadModal();
    }

    $("#sidebar")
      ?.classList.remove("open");
  }
);

(async function init() {
  setup();

  if (
    sessionStorage.getItem(
      "accessToken"
    )
  ) {
    try {
      state.user =
        await Auth.me();

      showApp();

      await loadFiles();

    } catch (error) {
      Auth.logout();
      showAuth("login");
    }

  } else {
    showAuth("login");
  }
})();
