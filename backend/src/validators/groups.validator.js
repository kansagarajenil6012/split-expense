import { z } from 'zod';

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    description: z.string().max(500).optional(),
    groupType: z.enum(['general', 'friends', 'office', 'food_club', 'sports', 'travel']).optional(),
    currency: z.string().length(3).optional(),
  }),
});

export const updateGroupSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(500).optional(),
    groupType: z.string().optional(),
    currency: z.string().length(3).optional(),
    isArchived: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const groupIdSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
});

export const inviteSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({ email: z.string().min(1, 'Email or Phone is required') }),
});

export const updateMemberSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    memberId: z.string().uuid(),
  }),
  body: z.object({ role: z.enum(['admin', 'member']).optional() }),
});

export const memberIdSchema = z.object({
  params: z.object({
    groupId: z.string().uuid(),
    memberId: z.string().uuid(),
  }),
});

export const cloneGroupSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(150),
  }),
});

export const transferOwnershipSchema = z.object({
  params: z.object({ groupId: z.string().uuid() }),
  body: z.object({
    toMemberId: z.string().uuid(),
  }),
});
