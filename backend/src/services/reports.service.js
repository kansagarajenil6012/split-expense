import { query } from '../config/database.js';
import { getGroupBalances } from '../engines/ledger.engine.js';

const reportsService = {
  async getSummary(groupId) {
    const { rows: expenseStats } = await query(
      `SELECT COUNT(*) as total_expenses, COALESCE(SUM(amount), 0) as total_amount
       FROM expenses WHERE group_id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [groupId]
    );

    const { rows: settlementStats } = await query(
      `SELECT COUNT(*) as total_settlements, COALESCE(SUM(amount), 0) as settled_amount
       FROM settlements WHERE group_id = $1 AND deleted_at IS NULL AND status = 'completed'`,
      [groupId]
    );

    const balances = await getGroupBalances(groupId);

    return {
      expenses: {
        count: parseInt(expenseStats[0].total_expenses, 10),
        totalAmount: parseFloat(expenseStats[0].total_amount),
      },
      settlements: {
        count: parseInt(settlementStats[0].total_settlements, 10),
        settledAmount: parseFloat(settlementStats[0].settled_amount),
      },
      balances,
    };
  },

  async getMemberReport(groupId) {
    const { rows } = await query(
      `SELECT gm.id as member_id, u.full_name,
              COALESCE((
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE e.paid_by_member_id = gm.id AND e.deleted_at IS NULL AND e.status = 'active'
              ), 0) as total_paid,
              COALESCE((
                SELECT SUM(ep.share_amount)
                FROM expense_participants ep
                JOIN expenses e ON e.id = ep.expense_id
                WHERE ep.member_id = gm.id AND ep.deleted_at IS NULL AND e.deleted_at IS NULL AND e.status = 'active'
              ), 0) as total_owed
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.status = 'active' AND gm.deleted_at IS NULL
       ORDER BY total_paid DESC`,
      [groupId]
    );
    return rows.map((r) => ({
      ...r,
      total_paid: parseFloat(r.total_paid),
      total_owed: parseFloat(r.total_owed),
    }));
  },

  async getMonthlyReport(groupId, year) {
    const { rows } = await query(
      `SELECT TO_CHAR(expense_date, 'YYYY-MM') as month,
              COUNT(*) as expense_count,
              SUM(amount) as total_amount
       FROM expenses
       WHERE group_id = $1 AND deleted_at IS NULL AND status = 'active'
         AND EXTRACT(YEAR FROM expense_date) = $2
       GROUP BY TO_CHAR(expense_date, 'YYYY-MM')
       ORDER BY month`,
      [groupId, year || new Date().getFullYear()]
    );
    return rows.map((r) => ({ ...r, total_amount: parseFloat(r.total_amount) }));
  },

  async getCategoryReport(groupId) {
    const { rows } = await query(
      `SELECT COALESCE(pc.name, 'Uncategorized') as category,
              COUNT(*) as expense_count,
              SUM(e.amount) as total_amount
       FROM expenses e
       LEFT JOIN expense_categories pc ON pc.id = e.category_id
       WHERE e.group_id = $1 AND e.deleted_at IS NULL AND e.status = 'active'
       GROUP BY pc.name
       ORDER BY total_amount DESC`,
      [groupId]
    );
    return rows.map((r) => ({ ...r, total_amount: parseFloat(r.total_amount) }));
  },
};

export default reportsService;
