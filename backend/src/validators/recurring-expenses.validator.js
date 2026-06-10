import { z } from 'zod';

export const createRecurringSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    templateTitle: z.string().min(1).max(200),
    amount: z.number().positive(),
    categoryId: z.string().uuid().optional().nullable(),
    paidByMemberId: z.string().uuid(),
    splitType: z.enum(['equal', 'unequal', 'percentage', 'shares']).default('equal'),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    intervalCount: z.number().int().min(1).optional(),
    nextRunAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export const updateRecurringSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    recurringId: z.string().uuid(),
  }),
  body: z.object({
    templateTitle: z.string().min(1).max(200).optional(),
    amount: z.number().positive().optional(),
    categoryId: z.string().uuid().optional().nullable(),
    paidByMemberId: z.string().uuid().optional(),
    splitType: z.enum(['equal', 'unequal', 'percentage', 'shares']).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
    intervalCount: z.number().int().min(1).optional(),
    nextRunAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const recurringIdSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    recurringId: z.string().uuid(),
  }),
});
