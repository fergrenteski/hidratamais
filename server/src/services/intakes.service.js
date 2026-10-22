import { randomUUID } from 'node:crypto';
import { getRepository } from '../repositories/index.js';
import { getUser } from './users.service.js';
import { AppError, notFound } from './errors.js';
import { localDate } from './stats.logic.js';

export async function addIntake(userId, { amountMl, timestamp }) {
  const user = await getUser(userId);
  const when = timestamp ? new Date(timestamp) : new Date();
  if (when.getTime() > Date.now() + 5 * 60_000) throw new AppError(400, 'VALIDATION_ERROR', 'Não dá para registrar água no futuro');
  return getRepository().addIntake({
    id: randomUUID(),
    userId,
    amountMl,
    timestamp: when.toISOString(),
    localDate: localDate(when, user.timezone),
  });
}

export async function listIntakes(userId, date) {
  const user = await getUser(userId);
  const day = date || localDate(new Date(), user.timezone);
  return { date: day, intakes: await getRepository().listIntakes(userId, { from: day, to: day }) };
}

export async function deleteIntake(userId, intakeId) {
  if (!(await getRepository().deleteIntake(userId, intakeId))) throw notFound('Registro');
}
