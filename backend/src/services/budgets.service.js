import budgetsRepository from '../repositories/budgets.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import { notFound, badRequest } from '../utils/app-error.js';
import { logActivity, getRequestMeta } from './audit.service.js';
import { getPagination } from '../utils/pagination.js';

const budgetsService = {
  async getBudgets(groupId, queryParams) {
    const { limit, offset } = getPagination(queryParams);
    return budgetsRepository.findByGroupId(groupId, { limit, offset });
  },

  async getBudget(groupId, budgetId) {
    const budget = await budgetsRepository.findById(budgetId);
    if (!budget || budget.group_id !== groupId) throw notFound('Budget');
    return budget;
  },

  async getActiveBudgets(groupId) {
    return budgetsRepository.findActiveByGroup(groupId);
  },

  async createBudget(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const budget = await budgetsRepository.create({
      groupId,
      categoryId: data.categoryId,
      name: data.name,
      amountLimit: data.amountLimit,
      currency: group.currency,
      period: data.period,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      alertThresholdPct: data.alertThresholdPct,
      createdBy: userId,
      budgetType: data.budgetType,
      memberId: data.memberId,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'budget',
      entityId: budget.id,
      action: 'create',
      summary: `Budget "${budget.name}" created with limit ${group.currency} ${budget.amount_limit}`,
      ...getRequestMeta(req),
    });

    return budget;
  },

  async updateBudget(groupId, budgetId, userId, data, req) {
    const budget = await budgetsRepository.findById(budgetId);
    if (!budget || budget.group_id !== groupId) throw notFound('Budget');

    const updated = await budgetsRepository.update(budgetId, {
      name: data.name ?? budget.name,
      amountLimit: data.amountLimit ?? budget.amount_limit,
      categoryId: data.categoryId !== undefined ? data.categoryId : budget.category_id,
      period: data.period ?? budget.period,
      periodStart: data.periodStart ?? budget.period_start,
      periodEnd: data.periodEnd ?? budget.period_end,
      alertThresholdPct: data.alertThresholdPct ?? budget.alert_threshold_pct,
      budgetType: data.budgetType ?? budget.budget_type,
      memberId: data.memberId !== undefined ? data.memberId : budget.member_id,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'budget',
      entityId: budgetId,
      action: 'update',
      summary: `Budget "${updated.name}" updated`,
      ...getRequestMeta(req),
    });

    return updated;
  },

  async deleteBudget(groupId, budgetId, userId, req) {
    const budget = await budgetsRepository.findById(budgetId);
    if (!budget || budget.group_id !== groupId) throw notFound('Budget');

    await budgetsRepository.softDelete(budgetId);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'budget',
      entityId: budgetId,
      action: 'delete',
      summary: `Budget "${budget.name}" deleted`,
      ...getRequestMeta(req),
    });
  },

  // Called after each expense creation to check budget alerts
  async checkBudgetAlerts(groupId) {
    const activeBudgets = await budgetsRepository.findActiveByGroup(groupId);
    const alerts = [];

    for (const budget of activeBudgets) {
      const spent = parseFloat(budget.spent_amount) || 0;
      const limit = parseFloat(budget.amount_limit);
      const pct = (spent / limit) * 100;
      const threshold = budget.alert_threshold_pct || 80;

      if (pct >= 100) {
        alerts.push({
          budgetId: budget.id,
          budgetName: budget.name,
          level: 'exceeded',
          percentage: Math.round(pct),
          spent,
          limit,
        });
      } else if (pct >= threshold) {
        alerts.push({
          budgetId: budget.id,
          budgetName: budget.name,
          level: 'warning',
          percentage: Math.round(pct),
          spent,
          limit,
        });
      }
    }

    // Send notifications for exceeded budgets
    if (alerts.length > 0) {
      const members = await groupMembersRepository.findByGroupId(groupId);
      for (const alert of alerts) {
        const notifications = members
          .filter((m) => m.user_id)
          .map((m) => ({
            userId: m.user_id,
            groupId,
            type: alert.level === 'exceeded' ? 'budget_exceeded' : 'budget_warning',
            title: alert.level === 'exceeded' ? '🚨 Budget Exceeded!' : '⚠️ Budget Warning',
            body: alert.level === 'exceeded'
              ? `Budget "${alert.budgetName}" has been exceeded (${alert.percentage}% used)`
              : `Budget "${alert.budgetName}" is at ${alert.percentage}% (threshold: ${alert.spent} / ${alert.limit})`,
            entityType: 'budget',
            entityId: alert.budgetId,
          }));
        if (notifications.length) await notificationsRepository.createMany(notifications);
      }
    }

    return alerts;
  },

  async restoreBudget(groupId, budgetId, userId, req) {
    const budget = await budgetsRepository.findDeletedById(budgetId);
    if (!budget || budget.group_id !== groupId) throw notFound('Budget');

    const restored = await budgetsRepository.restore(budgetId);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'budget',
      entityId: budgetId,
      action: 'restore',
      summary: `Restored budget "${budget.name}"`,
      ...getRequestMeta(req),
    });

    return restored;
  },
};

export default budgetsService;
