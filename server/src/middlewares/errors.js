import { ZodError } from 'zod';
import { AppError } from '../services/errors.js';

const send = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details && { details }) } });

export const notFoundApi = (req, res) => send(res, 404, 'NOT_FOUND', `Rota ${req.method} ${req.originalUrl} não existe`);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return send(res, 400, 'VALIDATION_ERROR', details[0]?.message || 'Dados inválidos', details);
  }
  if (err instanceof AppError) return send(res, err.status, err.code, err.message);
  if (err.type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'JSON inválido no corpo da requisição');
  if (err.code === 404) return send(res, 404, 'NOT_FOUND', 'Recurso não encontrado');
  if (err.code === 429) return send(res, 503, 'DB_THROTTLED', 'Banco ocupado, tente de novo em instantes');

  console.error(err);
  send(res, 500, 'INTERNAL_ERROR', 'Erro interno do servidor');
}
