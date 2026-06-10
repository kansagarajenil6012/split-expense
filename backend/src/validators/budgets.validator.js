import { z } from 'zod';

export const createBudgetSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(150),
    amountLimit: z.number().positive(),
    categoryId: z.string().uuid().optional().nullable(),
    period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    alertThresholdPct: z.number().int().min(1).max(100).optional(),
  }),
});

export const updateBudgetSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    budgetId: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    amountLimit: z.number().positive().optional(),
    categoryId: z.string().uuid().optional().nullable(),
    period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    alertThresholdPct: z.number().int().min(1).max(100).optional(),
  }),
});

export const budgetIdSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    budgetId: z.string().uuid(),
  }),
});
