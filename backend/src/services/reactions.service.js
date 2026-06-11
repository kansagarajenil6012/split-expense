import expenseReactionsRepository from '../repositories/expense-reactions.repository.js';
import { logActivity, getRequestMeta } from './audit.service.js';

const reactionsService = {
  async toggleReaction(expenseId, userId, emoji, groupId, req) {
    const result = await expenseReactionsRepository.toggle(expenseId, userId, emoji);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'expense',
      entityId: expenseId,
      action: 'react',
      summary: result.added ? `Reacted with ${emoji}` : `Removed ${emoji} reaction`,
      payload: { emoji, added: result.added },
      ...getRequestMeta(req),
    });

    return result;
  },

  async getReactions(expenseId) {
    return expenseReactionsRepository.findByExpenseId(expenseId);
  },

  async getReactionsForExpenses(expenseIds) {
    return expenseReactionsRepository.findByExpenseIds(expenseIds);
  },
};

export default reactionsService;
