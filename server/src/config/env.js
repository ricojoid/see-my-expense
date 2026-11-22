require('dotenv').config();

function required(name, check, hint) {
  const value = process.env[name];
  if (!value || (check && !check(value))) {
    console.error(`[config] ${name} is missing or invalid${hint ? ` (${hint})` : ''}. Set it in server/.env`);
    process.exit(1);
  }
  return value;
}

const env = {
  port: Number(process.env.PORT) || 4000,
  isProduction: process.env.NODE_ENV === 'production',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  tokenTtl: process.env.TOKEN_TTL || '7d',
  get jwtSecret() {
    return required('JWT_SECRET', (v) => v.length >= 32, 'at least 32 characters');
  },
};

module.exports = env;
