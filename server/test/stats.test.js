import { describe, it, expect } from 'vitest';
import { percent, nextDose, doseSchedule, currentStreak, bestStreak, localDate, summarize, addDays } from '../src/services/stats.logic.js';

const goals = { dailyGoalMl: 2000, dosesPerDay: 8, window: { start: '07:00', end: '21:00' }, defaultCupMl: 250 };
const totals = (obj) => new Map(Object.entries(obj));

describe('percent', () => {
  it('calcula a % da meta e pode passar de 100', () => {
    expect(percent(500, 2000)).toBe(25);
    expect(percent(2500, 2000)).toBe(125);
    expect(percent(0, 2000)).toBe(0);
  });
});

describe('doseSchedule', () => {
  it('distribui as doses de forma igual na janela', () => {
    expect(doseSchedule(goals)).toEqual(['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00']);
    expect(doseSchedule({ ...goals, dosesPerDay: 1 })).toEqual(['07:00']);
  });
});

describe('nextDose', () => {
  it('sugere o próximo horário quando está em dia', () => {
    expect(nextDose(goals, 250, 8 * 60)).toEqual({ time: '09:00', amountMl: 250, late: false });
  });
  it('sugere agora quando está atrasado', () => {
    expect(nextDose(goals, 0, 10 * 60 + 30)).toEqual({ time: '10:30', amountMl: 250, late: true });
  });
  it('limita o volume ao que falta e devolve null com a meta batida', () => {
    expect(nextDose(goals, 1900, 20 * 60).amountMl).toBe(100);
    expect(nextDose(goals, 2000, 12 * 60)).toBeNull();
  });
  it('antes da janela sugere o primeiro horário', () => {
    expect(nextDose(goals, 0, 5 * 60)).toEqual({ time: '07:00', amountMl: 250, late: false });
  });
});

describe('streaks', () => {
  const t = totals({ '2026-10-15': 2000, '2026-10-16': 2100, '2026-10-17': 2000, '2026-10-19': 2000, '2026-10-20': 2500, '2026-10-21': 2000, '2026-10-22': 300 });
  it('hoje incompleto não quebra a sequência', () => {
    expect(currentStreak(t, 2000, '2026-10-22')).toBe(3);
  });
  it('hoje batido entra na sequência', () => {
    expect(currentStreak(totals({ '2026-10-21': 2000, '2026-10-22': 2000 }), 2000, '2026-10-22')).toBe(2);
  });
  it('um dia sem meta zera a sequência atual', () => {
    expect(currentStreak(totals({ '2026-10-20': 2000 }), 2000, '2026-10-22')).toBe(0);
  });
  it('melhor sequência considera só dias consecutivos', () => {
    expect(bestStreak(t, 2000)).toBe(3);
    expect(bestStreak(totals({}), 2000)).toBe(0);
  });
  it('atravessa virada de mês', () => {
    expect(bestStreak(totals({ '2026-09-30': 2000, '2026-10-01': 2000 }), 2000)).toBe(2);
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('localDate', () => {
  it('agrupa pelo fuso do usuário', () => {
    const d = new Date('2026-10-23T01:30:00Z'); // 22:30 do dia 22 em São Paulo
    expect(localDate(d, 'America/Sao_Paulo')).toBe('2026-10-22');
    expect(localDate(d, 'UTC')).toBe('2026-10-23');
  });
});

describe('summarize', () => {
  it('monta média, melhor dia, taxa do mês e badges', () => {
    const s = summarize(totals({ '2026-10-01': 2000, '2026-10-02': 1000, '2026-10-03': 2400 }), 2000, '2026-10-04');
    expect(s.averageDailyMl).toBe(1800);
    expect(s.bestDay).toEqual({ date: '2026-10-03', totalMl: 2400 });
    expect(s.month.days).toHaveLength(4);
    expect(s.month.metDays).toBe(2);
    expect(s.month.rate).toBe(50);
    expect(s.currentStreak).toBe(1);
    expect(s.badges.find((b) => b.id === 'first-goal').earned).toBe(true);
    expect(s.badges.find((b) => b.id === 'streak-3').earned).toBe(false);
  });
});
