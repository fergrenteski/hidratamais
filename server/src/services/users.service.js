import { randomUUID } from 'node:crypto';
import { getRepository } from '../repositories/index.js';
import { AppError, notFound } from './errors.js';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export const DEFAULT_GOALS = {
  dailyGoalMl: 2000,
  dosesPerDay: 8,
  window: { start: '07:00', end: '22:00' },
  defaultCupMl: 250,
  weightKg: null,
};

const key = (name) => name.trim().toLocaleLowerCase('pt-BR');

async function assertNameFree(name, exceptId) {
  const taken = (await getRepository().findUsersByName(key(name))).some((u) => u.id !== exceptId);
  if (taken) throw new AppError(409, 'NAME_TAKEN', 'Já existe alguém com esse nome. Use "Retomar" para continuar de onde parou.');
}

export async function createUser({ name, timezone }) {
  await assertNameFree(name);
  return getRepository().createUser({
    id: randomUUID(),
    name: name.trim(),
    nameLower: key(name),
    timezone: timezone || DEFAULT_TIMEZONE,
    goals: DEFAULT_GOALS,
    createdAt: new Date().toISOString(),
  });
}

export async function getUser(userId) {
  const user = await getRepository().getUser(userId);
  if (!user) throw notFound('Usuário');
  return user;
}

export const searchUsers = (name) => getRepository().findUsersByName(key(name));

export async function updateUser(userId, { name, timezone }) {
  const user = await getUser(userId);
  if (name) {
    await assertNameFree(name, userId);
    Object.assign(user, { name: name.trim(), nameLower: key(name) });
  }
  if (timezone) user.timezone = timezone;
  return getRepository().updateUser(user);
}

export async function updateGoals(userId, goals) {
  const user = await getUser(userId);
  user.goals = { ...goals, weightKg: goals.weightKg ?? null };
  return getRepository().updateUser(user);
}

export async function deleteUser(userId) {
  await getUser(userId);
  const repo = getRepository();
  await repo.deleteIntakesForUser(userId);
  await repo.deleteUser(userId);
}
