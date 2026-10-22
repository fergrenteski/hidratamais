import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { router } from './routes/index.js';
import { errorHandler, notFoundApi } from './middlewares/errors.js';

function corsOptions(corsOrigin) {
  if (!corsOrigin) return { origin: false };
  if (corsOrigin === '*') return { origin: true };
  return { origin: corsOrigin.split(',').map((o) => o.trim()) };
}

export function createApp(config) {
  const app = express();
  app.set('trust proxy', 1); // Azure / OpenShift ficam atrás de um proxy reverso
  app.disable('x-powered-by');

  app.use(helmet());
  if (config.nodeEnv !== 'test') app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  const api = express.Router();
  api.use(cors(corsOptions(config.corsOrigin)));
  api.use(rateLimit({ windowMs: 60_000, limit: config.rateLimitPerMinute, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Muitas requisições, aguarde um minuto' } }) }));
  api.use(express.json({ limit: '10kb' }));
  api.use(router);
  api.use(notFoundApi);
  app.use('/api', api);

  // Frontend buildado + fallback de SPA (qualquer rota fora de /api devolve index.html).
  const indexHtml = path.join(config.staticDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api(\/|$)).*/, (req, res) => res.sendFile(indexHtml));
  }

  app.use(errorHandler);
  return app;
}
