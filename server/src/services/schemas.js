import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM');

const isValidTimeZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const nameSchema = z.string().trim().min(2, 'O nome precisa de pelo menos 2 caracteres').max(40, 'O nome pode ter no máximo 40 caracteres');
export const timezoneSchema = z.string().refine(isValidTimeZone, 'Fuso horário inválido');

export const createUserSchema = z.object({
  name: nameSchema,
  timezone: timezoneSchema.optional(),
});

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  timezone: timezoneSchema.optional(),
});

export const goalsSchema = z
  .object({
    dailyGoalMl: z.number().int().min(500).max(10000),
    dosesPerDay: z.number().int().min(1).max(24),
    window: z.object({ start: hhmm, end: hhmm }),
    defaultCupMl: z.number().int().min(1).max(2000),
    weightKg: z.number().min(20).max(400).nullable().optional(),
  })
  .refine((g) => g.window.start < g.window.end, { message: 'O fim da janela deve ser depois do início', path: ['window'] });

export const intakeSchema = z.object({
  amountMl: z.number().int().min(1).max(2000),
  timestamp: z.iso.datetime({ offset: true }).optional(),
});

export const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD').optional(),
});

export const historyQuerySchema = z.object({
  days: z.enum(['7', '30']).default('7').transform(Number),
});

export const searchQuerySchema = z.object({ name: nameSchema });
