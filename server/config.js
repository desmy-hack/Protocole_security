const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

if (!process.env.JWT_SECRET) {
  console.warn(
    '[config] ATTENTION: JWT_SECRET est absent du fichier .env. ' +
    'Créez un .env avec une valeur générée par: ' +
    'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
};
