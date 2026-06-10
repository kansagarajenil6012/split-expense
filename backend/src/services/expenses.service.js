import { getClient } from '../config/database.js';
import expensesRepository from '../repositories/expenses.repository.js';
import expenseParticipantsRepository from '../repositories/expense-participants.repository.js';
import ledgerRepository from '../repositories/ledger.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import { calculateSplit } from './split-calculator.service.js';
import { buildExpenseLedgerEntries } from '../engines/ledger.engine.js';
import { notFound, badRequest } from '../utils/app-error.js';
import { logActivity, logAudit, getRequestMeta } from './audit.service.js';
import { getPagination } from '../utils/pagination.js';
import budgetsService from './budgets.service.js';

const expensesService = {
  async createExpense(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const paidByMember = await groupMembersRepository.findById(data.paidByMemberId);
    if (!paidByMember || paidByMember.group_id !== groupId) {
      throw badRequest('Invalid payer');
    }

    const shares = calculateSplit({
      splitType: data.splitType,
      totalAmount: data.amount,
      participants: data.participants,
    });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const isPendingApproval = data.approvalStatus === 'pending';

      const expense = await expensesRepository.create({
        groupId,
        paidByMemberId: data.paidByMemberId,
        createdBy: userId,
        categoryId: data.categoryId,
        eventId: data.eventId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        currency: group.currency,
        expenseDate: data.expenseDate,
        splitType: data.splitType,
        notes: data.notes,
        costCenterId: data.costCenterId,
        projectName: data.projectName,
        approvalStatus: isPendingApproval ? 'pending' : 'approved',
        idempotencyKey: req.headers['idempotency-key'] || null,
      }, client);

      const participants = await expenseParticipantsRepository.createMany(
        shares.map((s) => ({ ...s, expenseId: expense.id })),
        client
      );

      if (!isPendingApproval) {
        const ledgerEntries = buildExpenseLedgerEntries({
          groupId,
          expenseId: expense.id,
          currency: group.currency,
          paidByMemberId: data.paidByMemberId,
          participants: shares,
          occurredAt: new Date(data.expenseDate),
        });
        await ledgerRepository.createEntries(ledgerEntries, client);
      }

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expense.id,
        action: 'create',
        summary: `Added expense "${expense.title}" for ${group.currency} ${expense.amount}`,
        payload: { amount: expense.amount, title: expense.title },
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'expense.create',
        entityType: 'expense',
        entityId: expense.id,
        afterState: expense,
      }, client);

      const members = await groupMembersRepository.findByGroupId(groupId);
      const notifications = members
        .filter((m) => m.user_id !== userId)
        .map((m) => ({
          userId: m.user_id,
          groupId,
          type: 'expense_added',
          title: 'New Expense',
          body: `New expense "${expense.title}" added to ${group.name}`,
          entityType: 'expense',
          entityId: expense.id,
        }));
      if (notifications.length) await notificationsRepository.createMany(notifications, client);

      await client.query('COMMIT');

      // Check budget alerts asynchronously (don't block response)
      budgetsService.checkBudgetAlerts(groupId).catch(console.error);

      return { ...expense, participants };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateExpense(groupId, expenseId, userId, data, req) {
    const existing = await expensesRepository.findById(expenseId);
    if (!existing || existing.group_id !== groupId) throw notFound('Expense');

    const group = await groupsRepository.findById(groupId);
    const mergedData = {
      title: data.title ?? existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      amount: data.amount ?? parseFloat(existing.amount),
      expenseDate: data.expenseDate ?? existing.expense_date,
      paidByMemberId: data.paidByMemberId ?? existing.paid_by_member_id,
      categoryId: data.categoryId !== undefined ? data.categoryId : existing.category_id,
      splitType: data.splitType ?? existing.split_type,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      receiptUrl: data.receiptUrl ?? existing.receipt_url,
      eventId: data.eventId !== undefined ? data.eventId : existing.event_id,
      costCenterId: data.costCenterId !== undefined ? data.costCenterId : existing.cost_center_id,
      projectName: data.projectName !== undefined ? data.projectName : existing.project_name,
      approvalStatus: data.approvalStatus ?? existing.approval_status,
    };

    if (mergedData.paidByMemberId !== existing.paid_by_member_id) {
      const paidByMember = await groupMembersRepository.findById(mergedData.paidByMemberId);
      if (!paidByMember || paidByMember.group_id !== groupId) {
        throw badRequest('Invalid payer');
      }
    }

    const participants = data.participants ||
      (await expenseParticipantsRepository.findByExpenseId(expenseId)).map((p) => ({
        memberId: p.member_id,
        shareAmount: parseFloat(p.share_amount),
        sharePercentage: p.share_percentage ? parseFloat(p.share_percentage) : undefined,
        shareUnits: p.share_units ? parseFloat(p.share_units) : undefined,
        isIncluded: p.is_included,
      }));

    const shares = calculateSplit({
      splitType: mergedData.splitType,
      totalAmount: mergedData.amount,
      participants,
    });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Void old ledger entries and participants
      await ledgerRepository.voidByReference('expense', expenseId, client);
      await expenseParticipantsRepository.softDeleteByExpenseId(expenseId, client);

      // Update expense record
      const updated = await expensesRepository.update(expenseId, mergedData, client);

      // Create new participants
      const newParticipants = await expenseParticipantsRepository.createMany(
        shares.map((s) => ({ ...s, expenseId })),
        client
      );

      // Create new ledger entries ONLY IF approved
      if (mergedData.approvalStatus === 'approved') {
        const ledgerEntries = buildExpenseLedgerEntries({
          groupId,
          expenseId,
          currency: group.currency,
          paidByMemberId: mergedData.paidByMemberId,
          participants: shares,
          occurredAt: new Date(mergedData.expenseDate),
        });
        await ledgerRepository.createEntries(ledgerEntries, client);
      }

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expenseId,
        action: 'update',
        summary: `Updated expense "${updated.title}" to ${group.currency} ${updated.amount}`,
        payload: { amount: updated.amount, title: updated.title },
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'expense.update',
        entityType: 'expense',
        entityId: expenseId,
        beforeState: existing,
        afterState: updated,
      }, client);

      // Notify group members
      const members = await groupMembersRepository.findByGroupId(groupId);
      const notifications = members
        .filter((m) => m.user_id !== userId)
        .map((m) => ({
          userId: m.user_id,
          groupId,
          type: 'expense_updated',
          title: 'Expense Updated',
          body: `Expense "${updated.title}" was updated in ${group.name}`,
          entityType: 'expense',
          entityId: expenseId,
        }));
      if (notifications.length) await notificationsRepository.createMany(notifications, client);

      await client.query('COMMIT');
      return { ...updated, participants: newParticipants };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getExpenses(groupId, query) {
    const { page, limit, offset } = getPagination(query);
    const { expenses, total } = await expensesRepository.findByGroupId(groupId, {
      limit, offset,
      from: query.from,
      to: query.to,
      categoryId: query.categoryId,
      memberId: query.memberId,
    });

    const withParticipants = await Promise.all(
      expenses.map(async (e) => ({
        ...e,
        participants: await expenseParticipantsRepository.findByExpenseId(e.id),
      }))
    );

    return { expenses: withParticipants, page, limit, total };
  },

  async getExpense(groupId, expenseId) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');
    const participants = await expenseParticipantsRepository.findByExpenseId(expenseId);
    return { ...expense, participants };
  },

  async deleteExpense(groupId, expenseId, userId, req) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await expensesRepository.softDelete(expenseId, client);
      await expenseParticipantsRepository.softDeleteByExpenseId(expenseId, client);
      await ledgerRepository.voidByReference('expense', expenseId, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expenseId,
        action: 'void',
        summary: `Voided expense "${expense.title}"`,
        ...getRequestMeta(req),
      }, client);

      await client.query('COMMIT');
      return { id: expenseId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async restoreExpense(groupId, expenseId, userId, req) {
    const expense = await expensesRepository.findDeletedById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');

    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      // Restore expense and its participants
      const restored = await expensesRepository.restore(expenseId, client);
      await expenseParticipantsRepository.restoreByExpenseId(expenseId, client);

      // Fetch restored active participants to recreate ledger entries
      const participants = await expenseParticipantsRepository.findByExpenseId(expenseId);

      // Recreate ledger entries
      const ledgerEntries = buildExpenseLedgerEntries({
        groupId,
        expenseId,
        currency: group.currency,
        paidByMemberId: expense.paid_by_member_id,
        participants: participants.map(p => ({
          memberId: p.member_id,
          shareAmount: parseFloat(p.share_amount),
        })),
        occurredAt: new Date(expense.expense_date),
      });
      await ledgerRepository.createEntries(ledgerEntries, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expenseId,
        action: 'restore',
        summary: `Restored expense "${expense.title}"`,
        payload: { amount: expense.amount, title: expense.title },
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'expense.restore',
        entityType: 'expense',
        entityId: expenseId,
        beforeState: { deleted: true },
        afterState: restored,
      }, client);

      await client.query('COMMIT');
      return restored;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

export default expensesService;
