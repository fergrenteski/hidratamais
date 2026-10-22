import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Em dev, lê o .env da raiz do repositório. Em produção as variáveis vêm do ambiente.
try {
  process.loadEnvFile(path.resolve(here, '../../../.env'));
} catch {
  /* sem .env: tudo bem */
}

const env = process.env;

export const config = {
  port: Number(env.PORT) || 8080,
  nodeEnv: env.NODE_ENV || 'development',
  dbDriver: env.DB_DRIVER || (env.COSMOS_ENDPOINT ? 'cosmos' : 'memory'),
  cosmos: {
    endpoint: env.COSMOS_ENDPOINT,
    key: env.COSMOS_KEY,
    database: env.COSMOS_DATABASE || 'hidratamais',
  },
  // Lista separada por vírgulas, "*" para qualquer origem, vazio = só mesma origem.
  corsOrigin: env.CORS_ORIGIN || '',
  staticDir: path.resolve(env.STATIC_DIR || path.resolve(here, '../../public')),
  rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE) || 120,
};
