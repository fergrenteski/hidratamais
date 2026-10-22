import * as stats from '../services/stats.service.js';
import { historyQuerySchema } from '../services/schemas.js';
import { getRepository } from '../repositories/index.js';

export const today = async (req, res) => res.json(await stats.today(req.params.userId));

export const history = async (req, res) => res.json(await stats.history(req.params.userId, historyQuerySchema.parse(req.query).days));

export const summary = async (req, res) => res.json(await stats.summary(req.params.userId));

// ?probe=liveness pula o banco: um Cosmos fora do ar não deve reiniciar o container em loop.
export const health = async (req, res) => {
  const repo = getRepository();
  if (req.query.probe === 'liveness') return res.json({ status: 'ok' });
  try {
    await repo.ping();
    res.json({ status: 'ok', db: repo.driver, time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: repo.driver, error: { code: 'DB_UNAVAILABLE', message: err.message } });
  }
};
