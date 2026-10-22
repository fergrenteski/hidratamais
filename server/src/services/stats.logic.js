// Lógica pura de datas e estatísticas (sem I/O) — coberta por test/stats.test.js.

export function localDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function localMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') * 60 + get('minute');
}

export function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const formatMinutes = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const portionMl = (goals) => Math.ceil(goals.dailyGoalMl / goals.dosesPerDay);

export const percent = (totalMl, goalMl) => (goalMl > 0 ? Math.round((totalMl / goalMl) * 100) : 0);

// Horários sugeridos distribuídos igualmente na janela (primeiro no início, último no fim).
export function doseSchedule({ dosesPerDay, window }) {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (dosesPerDay === 1) return [formatMinutes(start)];
  const step = (end - start) / (dosesPerDay - 1);
  return Array.from({ length: dosesPerDay }, (_, i) => formatMinutes(Math.round(start + i * step)));
}

// Próxima dose: o primeiro horário cujo volume acumulado ainda não foi coberto.
// Se esse horário já passou, sugere "agora" (late = true). Meta batida → null.
export function nextDose(goals, totalMl, nowMinutes) {
  if (totalMl >= goals.dailyGoalMl) return null;
  const portion = portionMl(goals);
  const slots = doseSchedule(goals).map(toMinutes);
  const slot = slots[Math.min(slots.length - 1, Math.floor(totalMl / portion))];
  return {
    time: formatMinutes(Math.max(slot, nowMinutes)),
    amountMl: Math.min(portion, goals.dailyGoalMl - totalMl),
    late: slot < nowMinutes,
  };
}

export function totalsByDay(intakes) {
  const totals = new Map();
  for (const i of intakes) totals.set(i.localDate, (totals.get(i.localDate) || 0) + i.amountMl);
  return totals;
}

// Dias seguidos batendo a meta até hoje. Hoje ainda em andamento não quebra a sequência.
export function currentStreak(totals, goalMl, today) {
  let day = (totals.get(today) || 0) >= goalMl ? today : addDays(today, -1);
  let streak = 0;
  while ((totals.get(day) || 0) >= goalMl) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(totals, goalMl) {
  const met = [...totals].filter(([, t]) => t >= goalMl).map(([d]) => d).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of met) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

export function series(totals, goalMl, today, days) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const totalMl = totals.get(date) || 0;
    return { date, totalMl, goalMl, pct: percent(totalMl, goalMl) };
  });
}

// ponytail: usa a meta atual para todo o histórico; guarde a meta por dia se ela mudar com frequência.
export function summarize(totals, goalMl, today) {
  const activeDays = [...totals.values()].filter((t) => t > 0);
  const totalAllMl = activeDays.reduce((a, b) => a + b, 0);
  const best = [...totals].reduce((acc, [date, totalMl]) => (!acc || totalMl > acc.totalMl ? { date, totalMl } : acc), null);
  const daysMet = [...totals.values()].filter((t) => t >= goalMl).length;

  const monthStart = `${today.slice(0, 8)}01`;
  const dayOfMonth = Number(today.slice(8, 10));
  const month = series(totals, goalMl, today, dayOfMonth);
  const monthMet = month.filter((d) => d.totalMl >= goalMl).length;

  const streak = currentStreak(totals, goalMl, today);
  const bestRun = bestStreak(totals, goalMl);

  const badges = [
    { id: 'first-sip', title: 'Primeiro gole', description: 'Registrou água pela primeira vez', earned: activeDays.length > 0 },
    { id: 'first-goal', title: 'Primeira meta batida', description: 'Bateu a meta diária pela primeira vez', earned: daysMet > 0 },
    { id: 'streak-3', title: '3 dias seguidos', description: 'Bateu a meta 3 dias em sequência', earned: bestRun >= 3 },
    { id: 'perfect-week', title: 'Semana perfeita', description: '7 dias seguidos batendo a meta', earned: bestRun >= 7 },
    { id: 'month-30', title: 'Maré cheia', description: '30 dias seguidos batendo a meta', earned: bestRun >= 30 },
    { id: 'liters-100', title: '100 litros', description: 'Somou 100 litros registrados', earned: totalAllMl >= 100_000 },
  ];

  return {
    today,
    goalMl,
    currentStreak: streak,
    bestStreak: bestRun,
    averageDailyMl: activeDays.length ? Math.round(totalAllMl / activeDays.length) : 0,
    bestDay: best,
    daysMet,
    month: { start: monthStart, days: month, metDays: monthMet, rate: percent(monthMet, dayOfMonth) },
    totalMl: totalAllMl,
    badges,
  };
}
