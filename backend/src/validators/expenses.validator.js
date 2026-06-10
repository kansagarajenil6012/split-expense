import { z } from 'zod';

const participantSchema = z.object({
  memberId: z.string().uuid(),
  shareAmount: z.number().positive().optional(),
  sharePercentage: z.number().min(0).max(100).optional(),
  shareUnits: z.number().positive().optional(),
  isIncluded: z.boolean().optional(),
});

export const createExpenseSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    amount: z.number().positive(),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paidByMemberId: z.string().uuid(),
    categoryId: z.string().uuid().optional().nullable(),
    splitType: z.enum(['equal', 'unequal', 'percentage', 'shares']).default('equal'),
    participants: z.array(participantSchema).min(1),
    notes: z.string().max(500).optional(),
  }),
});

export const expenseIdSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    expenseId: z.string().uuid(),
  }),
});

export const createSettlementSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    fromMemberId: z.string().uuid(),
    toMemberId: z.string().uuid(),
    amount: z.number().positive(),
    method: z.enum(['cash', 'upi', 'bank_transfer', 'other']).optional(),
    notes: z.string().max(500).optional(),
    status: z.enum(['pending', 'completed']).optional(),
    isSuggested: z.boolean().optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    expenseId: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    amount: z.number().positive().optional(),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paidByMemberId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional().nullable(),
    splitType: z.enum(['equal', 'unequal', 'percentage', 'shares']).optional(),
    participants: z.array(participantSchema).min(1).optional(),
    notes: z.string().max(500).optional().nullable(),
  }),
});

export const settlementIdSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    settlementId: z.string().uuid(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(150).optional(),
    phone: z.string().max(20).optional(),
    defaultCurrency: z.string().length(3).optional(),
    timezone: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  }),
});
