import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initRepository } from '../src/repositories/index.js';

const config = { dbDriver: 'memory', nodeEnv: 'test', corsOrigin: '', staticDir: '/nao-existe', rateLimitPerMinute: 1000 };
let app;

beforeAll(async () => {
  await initRepository(config);
  app = createApp(config);
});

describe('API', () => {
  it('fluxo completo: cria, busca, registra, resume e apaga', async () => {
    expect((await request(app).get('/api/health')).body.status).toBe('ok');

    const { body: user, status } = await request(app).post('/api/users').send({ name: '  Ana Clara ' });
    expect(status).toBe(201);
    expect(user.name).toBe('Ana Clara');
    expect(user.goals.dailyGoalMl).toBe(2000);
    expect(user.timezone).toBe('America/Sao_Paulo');

    expect((await request(app).post('/api/users').send({ name: 'ana clara' })).body.error.code).toBe('NAME_TAKEN');
    expect((await request(app).get('/api/users/search?name=ANA CLARA')).body).toHaveLength(1);

    const goals = { dailyGoalMl: 1000, dosesPerDay: 4, window: { start: '08:00', end: '20:00' }, defaultCupMl: 250, weightKg: 70 };
    expect((await request(app).put(`/api/users/${user.id}/goals`).send(goals)).body.goals.weightKg).toBe(70);

    const base = `/api/users/${user.id}`;
    const { body: intake } = await request(app).post(`${base}/intakes`).send({ amountMl: 600 });
    await request(app).post(`${base}/intakes`).send({ amountMl: 500 }).expect(201);

    const today = (await request(app).get(`${base}/stats/today`)).body;
    expect(today).toMatchObject({ totalMl: 1100, pct: 110, dosesTaken: 2, dosesPlanned: 4, goalReached: true, nextDose: null });

    expect((await request(app).get(`${base}/intakes`)).body.intakes).toHaveLength(2);
    await request(app).delete(`${base}/intakes/${intake.id}`).expect(204);
    expect((await request(app).get(`${base}/stats/today`)).body.totalMl).toBe(500);

    const hist = (await request(app).get(`${base}/stats/history?days=30`)).body;
    expect(hist.series).toHaveLength(30);
    expect(hist.series.at(-1).totalMl).toBe(500);

    expect((await request(app).get(`${base}/stats/summary`)).body.badges[0].earned).toBe(true);

    await request(app).delete(base).expect(204);
    const gone = await request(app).get(`${base}/stats/today`);
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('valida entradas e responde no formato de erro padrão', async () => {
    const bad = await request(app).post('/api/users').send({ name: 'A' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });

    const { body: user } = await request(app).post('/api/users').send({ name: 'Bruno' });
    expect((await request(app).post(`/api/users/${user.id}/intakes`).send({ amountMl: 2001 })).status).toBe(400);
    const goals = { dailyGoalMl: 400, dosesPerDay: 30, window: { start: '22:00', end: '07:00' }, defaultCupMl: 250 };
    expect((await request(app).put(`/api/users/${user.id}/goals`).send(goals)).status).toBe(400);
    expect((await request(app).get(`/api/users/${user.id}/stats/history?days=12`)).status).toBe(400);
    expect((await request(app).get('/api/nada')).body.error.code).toBe('NOT_FOUND');
  });
});
