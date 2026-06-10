import corporateRepository from '../repositories/corporate.repository.js';
import expensesRepository from '../repositories/expenses.repository.js';
import expenseParticipantsRepository from '../repositories/expense-participants.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import ledgerRepository from '../repositories/ledger.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import { getClient, query } from '../config/database.js';
import { notFound, badRequest, forbidden } from '../utils/app-error.js';
import { logActivity, logAudit, getRequestMeta } from './audit.service.js';
import { buildExpenseLedgerEntries } from '../engines/ledger.engine.js';

const corporateService = {
  // Departments
  async createDepartment(groupId, userId, data) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    return corporateRepository.createDepartment({
      groupId,
      name: data.name,
      managerMemberId: data.managerMemberId,
    });
  },

  async getDepartments(groupId) {
    return corporateRepository.getDepartmentsByGroupId(groupId);
  },

  // Cost Centers
  async createCostCenter(groupId, userId, data) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    return corporateRepository.createCostCenter({
      groupId,
      code: data.code,
      name: data.name,
    });
  },

  async getCostCenters(groupId) {
    return corporateRepository.getCostCentersByGroupId(groupId);
  },

  // Approvals Dashboard
  async getPendingExpenses(groupId) {
    const { rows } = await query(
      `SELECT e.*, u.full_name as created_by_name, pu.full_name as paid_by_name, cc.name as cost_center_name
       FROM expenses e
       JOIN users u ON u.id = e.created_by
       JOIN group_members pm ON pm.id = e.paid_by_member_id
       JOIN users pu ON pu.id = pm.user_id
       LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
       WHERE e.group_id = $1 AND e.approval_status = 'pending' AND e.deleted_at IS NULL`,
      [groupId]
    );
    return rows;
  },

  async approveExpense(groupId, expenseId, userId, req) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');
    if (expense.approval_status !== 'pending') throw badRequest('Expense is already processed');

    const group = await groupsRepository.findById(groupId);
    const participants = await expenseParticipantsRepository.findByExpenseId(expenseId);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Update approval status to approved
      await client.query(
        `UPDATE expenses SET approval_status = 'approved', approved_by = $1, status = 'active', updated_at = NOW()
         WHERE id = $2`,
        [userId, expenseId]
      );

      // Create ledger entries now that it is approved
      const ledgerEntries = buildExpenseLedgerEntries({
        groupId,
        expenseId,
        currency: group.currency,
        paidByMemberId: expense.paid_by_member_id,
        participants: participants.map((p) => ({
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
        action: 'update',
        summary: `Approved expense "${expense.title}" for ${group.currency} ${expense.amount}`,
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'expense.approve',
        entityType: 'expense',
        entityId: expenseId,
        beforeState: { approval_status: 'pending' },
        afterState: { approval_status: 'approved', approved_by: userId },
      }, client);

      await client.query('COMMIT');
      return { id: expenseId, approval_status: 'approved' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async rejectExpense(groupId, expenseId, userId, req) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');
    if (expense.approval_status !== 'pending') throw badRequest('Expense is already processed');

    await query(
      `UPDATE expenses SET approval_status = 'rejected', status = 'voided', updated_at = NOW() WHERE id = $1`,
      [expenseId]
    );

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'expense',
      entityId: expenseId,
      action: 'update',
      summary: `Rejected expense "${expense.title}"`,
      ...getRequestMeta(req),
    });

    return { id: expenseId, approval_status: 'rejected' };
  },

  // Payroll Export CSV generator
  async getPayrollExport(groupId) {
    const { rows: memberData } = await query(
      `SELECT gm.id as member_id, gm.employee_id, u.full_name, u.email,
              COALESCE((
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE e.paid_by_member_id = gm.id AND e.deleted_at IS NULL AND e.status = 'active' AND e.approval_status = 'approved'
              ), 0) as total_paid,
              COALESCE((
                SELECT SUM(ep.share_amount)
                FROM expense_participants ep
                JOIN expenses e ON e.id = ep.expense_id
                WHERE ep.member_id = gm.id AND ep.deleted_at IS NULL AND e.deleted_at IS NULL AND e.status = 'active' AND e.approval_status = 'approved'
              ), 0) as total_owed
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.status = 'active' AND gm.deleted_at IS NULL`,
      [groupId]
    );

    let csvContent = 'Employee ID,Full Name,Email,Total Paid,Total Owed,Net Balance,Reimbursement Claim\n';
    for (const m of memberData) {
      const paid = parseFloat(m.total_paid);
      const owed = parseFloat(m.total_owed);
      const balance = owed - paid; // positive balance means they owe (debts), negative balance means they are owed (reimbursements)
      const claim = balance < 0 ? Math.abs(balance) : 0;
      
      csvContent += `"${m.employee_id || ''}","${m.full_name}","${m.email || ''}",${paid.toFixed(2)},${owed.toFixed(2)},${balance.toFixed(2)},${claim.toFixed(2)}\n`;
    }
    return csvContent;
  }
};

export default corporateService;
