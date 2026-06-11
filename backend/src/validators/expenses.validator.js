import { z } from 'zod';

const participantSchema = z.object({
  memberId: z.string().uuid(),
  shareAmount: z.number().nonnegative().optional(),
  sharePercentage: z.number().min(0).max(100).optional(),
  shareUnits: z.number().nonnegative().optional(),
  isIncluded: z.boolean().optional(),
});

const payerSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().positive(),
});

const itemSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  quantity: z.number().int().positive().optional(),
  participants: z.array(z.object({ memberId: z.string().uuid() })).min(1),
});

const memberDaysSchema = z.object({
  memberId: z.string().uuid(),
  days: z.number().nonnegative(),
});

const memberConsumptionSchema = z.object({
  memberId: z.string().uuid(),
  units: z.number().nonnegative(),
});

const hybridConfigSchema = z.object({
  memberId: z.string().uuid(),
  method: z.enum(['fixed', 'percentage', 'equal']),
  value: z.number().nonnegative().optional(),
});

export const createExpenseSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    amount: z.number().positive(),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paidByMemberId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional().nullable(),
    splitType: z.enum([
      'equal', 'unequal', 'percentage', 'shares',
      'item_wise', 'days_wise', 'consumption_wise', 'hybrid'
    ]).default('equal'),
    participants: z.array(participantSchema).optional(),
    notes: z.string().max(500).optional(),
    payers: z.array(payerSchema).optional(),
    isDraft: z.boolean().optional(),
    items: z.array(itemSchema).optional(),
    memberDays: z.array(memberDaysSchema).optional(),
    memberConsumption: z.array(memberConsumptionSchema).optional(),
    hybridConfig: z.array(hybridConfigSchema).optional(),
    skipDuplicateCheck: z.boolean().optional(),
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
    status: z.enum(['pending', 'completed', 'requested']).optional(),
    isSuggested: z.boolean().optional(),
    isPartial: z.boolean().optional(),
    parentSettlementId: z.string().uuid().optional(),
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
    splitType: z.enum([
      'equal', 'unequal', 'percentage', 'shares',
      'item_wise', 'days_wise', 'consumption_wise', 'hybrid'
    ]).optional(),
    participants: z.array(participantSchema).optional(),
    notes: z.string().max(500).optional().nullable(),
    payers: z.array(payerSchema).optional(),
    isDraft: z.boolean().optional(),
    items: z.array(itemSchema).optional(),
    memberDays: z.array(memberDaysSchema).optional(),
    memberConsumption: z.array(memberConsumptionSchema).optional(),
    hybridConfig: z.array(hybridConfigSchema).optional(),
    changeReason: z.string().max(255).optional(),
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

export const previewSplitSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
    splitType: z.enum([
      'equal', 'unequal', 'percentage', 'shares',
      'item_wise', 'days_wise', 'consumption_wise', 'hybrid'
    ]),
    participants: z.array(participantSchema).optional(),
    items: z.array(itemSchema).optional(),
    memberDays: z.array(memberDaysSchema).optional(),
    memberConsumption: z.array(memberConsumptionSchema).optional(),
    hybridConfig: z.array(hybridConfigSchema).optional(),
  }),
});

export const commentSchema = z.object({
  body: z.object({
    entityType: z.enum(['expense', 'group', 'settlement']).default('expense'),
    content: z.string().min(1).max(2000),
    parentId: z.string().uuid().optional().nullable(),
  }),
});

export const reactionSchema = z.object({
  body: z.object({
    emoji: z.string().min(1).max(10),
  }),
});

export const requestSettlementSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    fromMemberId: z.string().uuid(),
    toMemberId: z.string().uuid(),
    amount: z.number().positive(),
    method: z.enum(['cash', 'upi', 'bank_transfer', 'other']).optional(),
    notes: z.string().max(500).optional(),
    isPartial: z.boolean().optional(),
    parentSettlementId: z.string().uuid().optional(),
  }),
});

export const reverseSettlementSchema = z.object({
  body: z.object({
    reason: z.string().min(1).max(250),
  }),
});

export const sendReminderSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    toMemberId: z.string().uuid(),
    amount: z.number().positive(),
    message: z.string().max(250).optional(),
  }),
});
