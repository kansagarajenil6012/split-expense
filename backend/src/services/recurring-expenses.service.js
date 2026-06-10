import recurringExpensesRepository from '../repositories/recurring-expenses.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import expensesService from './expenses.service.js';
import { notFound, badRequest } from '../utils/app-error.js';
import { logActivity, getRequestMeta } from './audit.service.js';
import { getPagination } from '../utils/pagination.js';
import dayjs from 'dayjs';

const recurringExpensesService = {
  async list(groupId, queryParams) {
    const { limit, offset } = getPagination(queryParams);
    return recurringExpensesRepository.findByGroupId(groupId, { limit, offset });
  },

  async get(groupId, id) {
    const item = await recurringExpensesRepository.findById(id);
    if (!item || item.group_id !== groupId) throw notFound('Recurring Expense');
    return item;
  },

  async create(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const members = await groupMembersRepository.findByGroupId(groupId);
    const splitConfig = { participants: members.map(m => ({ memberId: m.id, isIncluded: true })) };

    const item = await recurringExpensesRepository.create({
      groupId,
      templateTitle: data.templateTitle,
      amount: data.amount,
      currency: group.currency,
      categoryId: data.categoryId,
      paidByMemberId: data.paidByMemberId,
      splitType: data.splitType || 'equal',
      splitConfig,
      frequency: data.frequency,
      intervalCount: data.intervalCount || 1,
      nextRunAt: data.nextRunAt,
      createdBy: userId,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'recurring_expense',
      entityId: item.id,
      action: 'create',
      summary: `Recurring expense "${item.template_title}" created (${data.frequency})`,
      ...getRequestMeta(req),
    });

    return item;
  },

  async update(groupId, id, userId, data, req) {
    const existing = await recurringExpensesRepository.findById(id);
    if (!existing || existing.group_id !== groupId) throw notFound('Recurring Expense');

    const updated = await recurringExpensesRepository.update(id, {
      templateTitle: data.templateTitle ?? existing.template_title,
      amount: data.amount ?? existing.amount,
      categoryId: data.categoryId !== undefined ? data.categoryId : existing.category_id,
      paidByMemberId: data.paidByMemberId ?? existing.paid_by_member_id,
      splitType: data.splitType ?? existing.split_type,
      splitConfig: data.splitConfig ?? existing.split_config,
      frequency: data.frequency ?? existing.frequency,
      intervalCount: data.intervalCount ?? existing.interval_count,
      nextRunAt: data.nextRunAt ?? existing.next_run_at,
      isActive: data.isActive !== undefined ? data.isActive : existing.is_active,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'recurring_expense',
      entityId: id,
      action: 'update',
      summary: `Recurring expense "${updated.template_title}" updated`,
      ...getRequestMeta(req),
    });

    return updated;
  },

  async delete(groupId, id, userId, req) {
    const item = await recurringExpensesRepository.findById(id);
    if (!item || item.group_id !== groupId) throw notFound('Recurring Expense');

    await recurringExpensesRepository.softDelete(id);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'recurring_expense',
      entityId: id,
      action: 'delete',
      summary: `Recurring expense "${item.template_title}" deleted`,
      ...getRequestMeta(req),
    });
  },

  // Called by a cron job or on app startup to process due recurring expenses
  async processDueItems() {
    const dueItems = await recurringExpensesRepository.findDueItems();
    let processed = 0;

    for (const item of dueItems) {
      try {
        const group = await groupsRepository.findById(item.group_id);
        if (!group) continue;

        const members = await groupMembersRepository.findByGroupId(item.group_id);
        const participants = members.map(m => ({ memberId: m.id, isIncluded: true }));

        // Create actual expense from template
        await expensesService.createExpense(item.group_id, item.created_by, {
          title: item.template_title,
          amount: parseFloat(item.amount),
          expenseDate: dayjs().format('YYYY-MM-DD'),
          paidByMemberId: item.paid_by_member_id,
          categoryId: item.category_id,
          splitType: item.split_type,
          participants,
          notes: `Auto-generated from recurring expense`,
        }, { headers: {}, connection: {} });

        // Calculate next run date
        const nextRun = calculateNextRun(item.next_run_at, item.frequency, item.interval_count);
        await recurringExpensesRepository.updateNextRun(item.id, nextRun, dayjs().format('YYYY-MM-DD'));
        processed++;
      } catch (err) {
        console.error(`Failed to process recurring expense ${item.id}:`, err.message);
      }
    }

    return { processed, total: dueItems.length };
  },
};

function calculateNextRun(currentDate, frequency, intervalCount) {
  const current = dayjs(currentDate);
  switch (frequency) {
    case 'daily': return current.add(intervalCount, 'day').format('YYYY-MM-DD');
    case 'weekly': return current.add(intervalCount, 'week').format('YYYY-MM-DD');
    case 'monthly': return current.add(intervalCount, 'month').format('YYYY-MM-DD');
    case 'yearly': return current.add(intervalCount, 'year').format('YYYY-MM-DD');
    default: return current.add(1, 'month').format('YYYY-MM-DD');
  }
}

export default recurringExpensesService;
