export type Goals = {
  dailyGoalMl: number;
  dosesPerDay: number;
  window: { start: string; end: string };
  defaultCupMl: number;
  weightKg: number | null;
};

export type User = { id: string; name: string; timezone: string; goals: Goals; createdAt: string };
export type UserMatch = Pick<User, 'id' | 'name' | 'createdAt'>;
export type Intake = { id: string; amountMl: number; timestamp: string; localDate: string };

export type Today = {
  date: string;
  timezone: string;
  totalMl: number;
  goalMl: number;
  pct: number;
  remainingMl: number;
  dosesTaken: number;
  dosesPlanned: number;
  portionMl: number;
  schedule: string[];
  nextDose: { time: string; amountMl: number; late: boolean } | null;
  goalReached: boolean;
};

export type DayPoint = { date: string; totalMl: number; goalMl: number; pct: number };

export type Summary = {
  today: string;
  goalMl: number;
  currentStreak: number;
  bestStreak: number;
  averageDailyMl: number;
  bestDay: { date: string; totalMl: number } | null;
  daysMet: number;
  month: { start: string; days: DayPoint[]; metDays: number; rate: number };
  totalMl: number;
  badges: { id: string; title: string; description: string; earned: boolean }[];
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// Disparado quando o perfil salvo no navegador não existe mais no banco (trocou de DB, foi excluído...).
export const USER_MISSING = 'hm:user-missing';

// Vazio = mesma origem (imagem única). Defina VITE_API_URL só se hospedar o front separado.
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Sem JSON = a resposta não veio da nossa API (ex.: proxy do Vite com o backend ainda subindo).
    if (!body?.error) throw new ApiError(res.status, 'UNAVAILABLE', 'O servidor não respondeu. Se ele acabou de iniciar, aguarde alguns segundos e tente de novo.');
    if (body.error.code === 'USER_NOT_FOUND') window.dispatchEvent(new Event(USER_MISSING));
    throw new ApiError(res.status, body.error.code, body.error.message);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });
const u = (id: string) => `/users/${encodeURIComponent(id)}`;

export const api = {
  createUser: (name: string) =>
    req<User>('/users', json('POST', { name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })),
  searchUsers: (name: string) => req<UserMatch[]>(`/users/search?name=${encodeURIComponent(name)}`),
  getUser: (id: string) => req<User>(u(id)),
  updateUser: (id: string, data: { name?: string; timezone?: string }) => req<User>(u(id), json('PATCH', data)),
  updateGoals: (id: string, goals: Goals) => req<User>(`${u(id)}/goals`, json('PUT', goals)),
  deleteUser: (id: string) => req<void>(u(id), { method: 'DELETE' }),
  addIntake: (id: string, amountMl: number) => req<Intake>(`${u(id)}/intakes`, json('POST', { amountMl })),
  listIntakes: (id: string, date?: string) =>
    req<{ date: string; intakes: Intake[] }>(`${u(id)}/intakes${date ? `?date=${date}` : ''}`),
  deleteIntake: (id: string, intakeId: string) => req<void>(`${u(id)}/intakes/${intakeId}`, { method: 'DELETE' }),
  today: (id: string) => req<Today>(`${u(id)}/stats/today`),
  history: (id: string, days: 7 | 30) => req<{ days: number; series: DayPoint[] }>(`${u(id)}/stats/history?days=${days}`),
  summary: (id: string) => req<Summary>(`${u(id)}/stats/summary`),
};
