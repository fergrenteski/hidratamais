import { getRepository } from '../repositories/index.js';
import { getUser } from './users.service.js';
import * as logic from './stats.logic.js';

export async function today(userId, now = new Date()) {
  const user = await getUser(userId);
  const { goals, timezone } = user;
  const date = logic.localDate(now, timezone);
  const intakes = await getRepository().listIntakes(userId, { from: date, to: date });
  const totalMl = intakes.reduce((sum, i) => sum + i.amountMl, 0);

  return {
    date,
    timezone,
    totalMl,
    goalMl: goals.dailyGoalMl,
    pct: logic.percent(totalMl, goals.dailyGoalMl),
    remainingMl: Math.max(0, goals.dailyGoalMl - totalMl),
    dosesTaken: intakes.length,
    dosesPlanned: goals.dosesPerDay,
    portionMl: logic.portionMl(goals),
    schedule: logic.doseSchedule(goals),
    nextDose: logic.nextDose(goals, totalMl, logic.localMinutes(now, timezone)),
    goalReached: totalMl >= goals.dailyGoalMl,
  };
}

export async function history(userId, days, now = new Date()) {
  const user = await getUser(userId);
  const end = logic.localDate(now, user.timezone);
  const intakes = await getRepository().listIntakes(userId, { from: logic.addDays(end, -(days - 1)), to: end });
  return { days, series: logic.series(logic.totalsByDay(intakes), user.goals.dailyGoalMl, end, days) };
}

// ponytail: lê todo o histórico do usuário (query numa única partição). Se crescer muito,
// mantenha um documento de totais diários por usuário.
export async function summary(userId, now = new Date()) {
  const user = await getUser(userId);
  const intakes = await getRepository().listIntakes(userId);
  return logic.summarize(logic.totalsByDay(intakes), user.goals.dailyGoalMl, logic.localDate(now, user.timezone));
}
