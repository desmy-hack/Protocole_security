const express = require('express');
const bcrypt = require('bcrypt');
const config = require('./config');
const jwt = require('jsonwebtoken');
const db = require('./db');
const authenticateToken = require('./auth');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));

// Configuration du stockage des fichiers chiffrés
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'storage'));
  },

  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(32).toString('hex');
    cb(null, `${randomName}.bin`);
  }
});

// Limite de taille : 50 Mo
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

app.use(express.json());

// le route de test

app.get('/', (req, res) => {
  res.json({
    message: 'Le serveur fonctionne.',
    database: 'connectée'
  });
});


// petit test pour le serveur et la bd

app.get('/api/health', (req, res) => {
  try {
    const result = db.prepare('SELECT 1 AS ok').get();

    res.json({
      server: 'ok',
      database: result.ok === 1 ? 'ok' : 'erreur'
    });
  } catch (error) {
    console.error('[DB]', error);

    res.status(500).json({
      server: 'ok',
      database: 'erreur'
    });
  }
});

// inscription
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérification des données reçues
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email et mot de passe obligatoires.'
      });
    }

    // Vérification simple du mot de passe
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères.'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email);

    if (existingUser) {
      return res.status(409).json({
        error: 'Cette adresse email est déjà utilisée.'
      });
    }

    // Hachage du mot de passe
    const passwordHash = await bcrypt.hash(password, 12);

    // Enregistrement dans SQLite
    const result = db
      .prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `)
      .run(email, passwordHash);

    res.status(201).json({
      message: 'Utilisateur créé avec succès.',
      userId: result.lastInsertRowid
    });

  } catch (error) {
    console.error('[REGISTER]', error);

    res.status(500).json({
      error: 'Erreur interne du serveur.'
    });
  }
});

// connexion
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérification des données reçues
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email et mot de passe obligatoires.'
      });
    }

    // Recherche de l'utilisateur dans la base
    const user = db
      .prepare(`
        SELECT id, email, password_hash
        FROM users
        WHERE email = ?
      `)
      .get(email);

    // Si l'utilisateur n'existe pas
    if (!user) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect.'
      });
    }

    // Vérification du mot de passe
    const passwordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    // Si le mot de passe est incorrect
    if (!passwordCorrect) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect.'
      });
    }

    // Création du JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      config.jwtSecret,
      {
        expiresIn: '1h'
      }
    );

    // Réponse envoyée au client
    res.json({
      message: 'Connexion réussie.',
      token: token
    });

  } catch (error) {
    console.error('[LOGIN]', error);

    res.status(500).json({
      error: 'Erreur interne du serveur.'
    });
  }
});


// route protégée : informations de l'utilisateur connecté
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({
    message: 'Authentification réussie.',
    user: {
      id: req.user.userId,
      email: req.user.email
    }
  });
});


// Upload d'un fichier chiffré

app.post(
  '/api/files',
  authenticateToken,
  upload.single('file'),
  (req, res) => {
    try {
      // Vérifier qu'un fichier a bien été envoyé
      if (!req.file) {
        return res.status(400).json({
          error: 'Aucun fichier chiffré reçu.'
        });
      }

      // Récupérer les métadonnées envoyées par le navigateur
      const {
        salt,
        iv,
        sha256Hash,
        originalName
      } = req.body;

	// Vérifier les métadonnées obligatoires
	if (!salt || !iv || !sha256Hash || !originalName) {
	  const fs = require('fs');

	  // Supprimer le fichier déjà créé par Multer
	  try {
	    fs.unlinkSync(req.file.path);
	  } catch (cleanupError) {
	    console.error('[UPLOAD CLEANUP]', cleanupError);
	  }

	  return res.status(400).json({
	    error: 'Métadonnées du fichier incomplètes.'
	  });
	}
	
	// Vérifier le nom original du fichier
	if (
	  typeof originalName !== 'string' ||
	  originalName.trim().length === 0 ||
	  originalName.length > 255
	) {
	  const fs = require('fs');

	  try {
	    fs.unlinkSync(req.file.path);
	  } catch (cleanupError) {
	    console.error('[UPLOAD CLEANUP]', cleanupError);
	  }

	  return res.status(400).json({
	    error: 'Nom de fichier invalide.'
	  });
	}


	// Vérifier le format hexadécimal
	const hexRegex = /^[0-9a-fA-F]+$/;

	if (!hexRegex.test(salt) ||
	    !hexRegex.test(iv) ||
	    !hexRegex.test(sha256Hash)) {

	  const fs = require('fs');

	  try {
	    fs.unlinkSync(req.file.path);
	  } catch (cleanupError) {
	    console.error('[UPLOAD CLEANUP]', cleanupError);
	  }

	  return res.status(400).json({
	    error: 'Format des métadonnées cryptographiques invalide.'
	  });
	}


	// Vérifier les longueurs exactes
	if (
	  salt.length !== 32 ||
	  iv.length !== 24 ||
	  sha256Hash.length !== 64
	) {
	  const fs = require('fs');

	  try {
	    fs.unlinkSync(req.file.path);
	  } catch (cleanupError) {
	    console.error('[UPLOAD CLEANUP]', cleanupError);
	  }

	  return res.status(400).json({
	    error: 'Taille des métadonnées cryptographiques invalide.'
	  });
	}

      // Générer un token de partage aléatoire
      const shareToken = crypto.randomBytes(32).toString('hex');

      // Enregistrer les métadonnées dans SQLite
      const result = db.prepare(`
        INSERT INTO files (
          owner_id,
          share_token,
          original_name,
          stored_name,
          salt,
          iv,
          sha256_hash,
          size_bytes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.userId,
        shareToken,
        originalName,
        req.file.filename,
        salt,
        iv,
        sha256Hash,
        req.file.size
      );

      res.status(201).json({
        message: 'Fichier chiffré enregistré avec succès.',
        fileId: result.lastInsertRowid,
        originalName: originalName,
        size: req.file.size,
        shareToken: shareToken
      });

    } catch (error) {
      console.error('[UPLOAD]', error);

      // Si SQLite échoue après création du fichier,
      // supprimer le fichier physique
      if (req.file) {
        const fs = require('fs');

        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('[UPLOAD CLEANUP]', cleanupError);
        }
      }

      res.status(500).json({
        error: 'Erreur interne lors de l\'enregistrement du fichier.'
      });
    }
  }
);


// Liste des fichiers de l'utilisateur connecté
app.get('/api/files', authenticateToken, (req, res) => {
  try {
    const files = db.prepare(`
      SELECT
        id,
        original_name,
        size_bytes,
        created_at,
        share_token
      FROM files
      WHERE owner_id = ?
      ORDER BY created_at DESC
    `).all(req.user.userId);

    res.json({
      files: files
    });

  } catch (error) {
    console.error('[LIST FILES]', error);

    res.status(500).json({
      error: 'Erreur interne lors de la récupération des fichiers.'
    });
  }
});


// Récupérer les métadonnées d'un fichier
app.get('/api/files/:id/metadata', authenticateToken, (req, res) => {
  try {
    const fileId = Number(req.params.id);

    // Vérifier que l'identifiant est valide
    if (!Number.isInteger(fileId) || fileId <= 0) {
      return res.status(400).json({
        error: 'Identifiant de fichier invalide.'
      });
    }

    // Rechercher uniquement un fichier appartenant
    // à l'utilisateur connecté
    const file = db.prepare(`
      SELECT
        id,
        original_name,
        size_bytes,
        salt,
        iv,
        sha256_hash,
        created_at
      FROM files
      WHERE id = ?
        AND owner_id = ?
    `).get(fileId, req.user.userId);

    // Fichier inexistant ou appartenant à un autre utilisateur
    if (!file) {
      return res.status(404).json({
        error: 'Fichier introuvable.'
      });
    }

    res.json({
      fileId: file.id,
      originalName: file.original_name,
      size: file.size_bytes,
      salt: file.salt,
      iv: file.iv,
      sha256Hash: file.sha256_hash,
      createdAt: file.created_at
    });

  } catch (error) {
    console.error('[FILE METADATA]', error);

    res.status(500).json({
      error: 'Erreur interne lors de la récupération des métadonnées.'
    });
  }
});


// Télécharger un fichier chiffré
app.get('/api/files/:id', authenticateToken, (req, res) => {
  try {
    const fileId = Number(req.params.id);

    // Vérifier que l'identifiant est bien un nombre
    if (!Number.isInteger(fileId) || fileId <= 0) {
      return res.status(400).json({
        error: 'Identifiant de fichier invalide.'
      });
    }

    // Chercher le fichier appartenant à l'utilisateur connecté
    const file = db.prepare(`
      SELECT
        id,
        owner_id,
        original_name,
        stored_name,
        salt,
        iv,
        sha256_hash,
        size_bytes
      FROM files
      WHERE id = ?
        AND owner_id = ?
    `).get(fileId, req.user.userId);

    // Fichier inexistant ou appartenant à un autre utilisateur
    if (!file) {
      return res.status(404).json({
        error: 'Fichier introuvable.'
      });
    }

    // Chemin physique du fichier chiffré
    const filePath = path.join(
      __dirname,
      'storage',
      file.stored_name
    );

    // Vérifier que le fichier existe réellement sur le disque
    const fs = require('fs');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Fichier physique introuvable.'
      });
    }

    // Envoyer le fichier chiffré
    res.download(
      filePath,
      file.original_name,
      (error) => {
        if (error) {
          console.error('[DOWNLOAD]', error);
        }
      }
    );

  } catch (error) {
    console.error('[DOWNLOAD]', error);

    res.status(500).json({
      error: 'Erreur interne lors de la récupération du fichier.'
    });
  }
});


// Supprimer un fichier
app.delete('/api/files/:id', authenticateToken, (req, res) => {
  try {
    const fileId = Number(req.params.id);

    // Vérifier que l'identifiant est valide
    if (!Number.isInteger(fileId) || fileId <= 0) {
      return res.status(400).json({
        error: 'Identifiant de fichier invalide.'
      });
    }

    // Chercher uniquement un fichier appartenant
    // à l'utilisateur connecté
    const file = db.prepare(`
      SELECT
        id,
        stored_name,
        original_name
      FROM files
      WHERE id = ?
        AND owner_id = ?
    `).get(fileId, req.user.userId);

    // Fichier inexistant ou appartenant à un autre utilisateur
    if (!file) {
      return res.status(404).json({
        error: 'Fichier introuvable.'
      });
    }

    const fs = require('fs');

    const filePath = path.join(
      __dirname,
      'storage',
      file.stored_name
    );

    // Supprimer le fichier physique
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Supprimer l'entrée SQLite
    db.prepare(`
      DELETE FROM files
      WHERE id = ?
        AND owner_id = ?
    `).run(fileId, req.user.userId);

    res.json({
      message: 'Fichier supprimé avec succès.',
      fileId: file.id,
      originalName: file.original_name
    });

  } catch (error) {
    console.error('[DELETE FILE]', error);

    res.status(500).json({
      error: 'Erreur interne lors de la suppression du fichier.'
    });
  }
});


// Accéder à un fichier partagé avec son token
app.get('/api/share/:token', (req, res) => {
  try {
    const shareToken = req.params.token;

    // Vérifier que le token existe
    if (!shareToken) {
      return res.status(400).json({
        error: 'Token de partage manquant.'
      });
    }

    // Rechercher le fichier correspondant au token
    const file = db.prepare(`
      SELECT
        id,
        original_name,
        stored_name,
        salt,
        iv,
        sha256_hash,
        size_bytes,
        created_at
      FROM files
      WHERE share_token = ?
    `).get(shareToken);

    // Token inconnu
    if (!file) {
      return res.status(404).json({
        error: 'Lien de partage invalide ou fichier introuvable.'
      });
    }

    const fs = require('fs');

    const filePath = path.join(
      __dirname,
      'storage',
      file.stored_name
    );

    // Vérifier que le fichier existe réellement
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Fichier physique introuvable.'
      });
    }

    // Envoyer les métadonnées nécessaires au navigateur
    res.json({
      fileId: file.id,
      originalName: file.original_name,
      size: file.size_bytes,
      salt: file.salt,
      iv: file.iv,
      sha256Hash: file.sha256_hash,
      createdAt: file.created_at,
      downloadUrl: `/api/share/${shareToken}/download`
    });

  } catch (error) {
    console.error('[SHARE]', error);

    res.status(500).json({
      error: 'Erreur interne lors de l\'accès au partage.'
    });
  }
});


// Télécharger un fichier via son token de partage
app.get('/api/share/:token/download', (req, res) => {
  try {
    const shareToken = req.params.token;

    // Vérifier que le token existe
    if (!shareToken) {
      return res.status(400).json({
        error: 'Token de partage manquant.'
      });
    }

    // Rechercher le fichier associé au token
    const file = db.prepare(`
      SELECT
        original_name,
        stored_name
      FROM files
      WHERE share_token = ?
    `).get(shareToken);

    // Token inconnu
    if (!file) {
      return res.status(404).json({
        error: 'Lien de partage invalide ou fichier introuvable.'
      });
    }

    const fs = require('fs');

    const filePath = path.join(
      __dirname,
      'storage',
      file.stored_name
    );

    // Vérifier que le fichier existe réellement
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Fichier physique introuvable.'
      });
    }

    // Envoyer le fichier chiffré
    res.download(
      filePath,
      file.original_name,
      (error) => {
        if (error) {
          console.error('[SHARE DOWNLOAD]', error);
        }
      }
    );

  } catch (error) {
    console.error('[SHARE DOWNLOAD]', error);

    res.status(500).json({
      error: 'Erreur interne lors du téléchargement.'
    });
  }
});


// Gestion globale des erreurs Multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('[MULTER]', error.code);

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Le fichier est trop volumineux. Taille maximale : 50 Mo.'
      });
    }

    return res.status(400).json({
      error: 'Erreur lors de l\'envoi du fichier.'
    });
  }

  next(error);
});


// démarage du server
app.listen(config.port, () => {
  console.log(
    `Serveur en écoute sur http://localhost:${config.port}`
  );
});
