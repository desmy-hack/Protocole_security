const jwt = require('jsonwebtoken');
const config = require('./config');

function authenticateToken(req, res, next) {
  try {
    // Récupérer le header Authorization
    const authHeader = req.headers.authorization;

    // Vérifier que le header existe
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token d\'authentification manquant.'
      });
    }

    // Vérifier le format : Bearer TOKEN
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Format du token invalide.'
      });
    }

    const token = parts[1];

    // Vérifier le JWT
    const decoded = jwt.verify(token, config.jwtSecret);

    // Stocker les informations de l'utilisateur
    // pour les prochaines routes
    req.user = decoded;

    // Continuer vers la route demandée
    next();

  } catch (error) {
    console.error('[AUTH]', error.message);

    return res.status(401).json({
      error: 'Token invalide ou expiré.'
    });
  }
}

module.exports = authenticateToken;
