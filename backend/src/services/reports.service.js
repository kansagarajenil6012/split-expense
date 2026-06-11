import { query } from '../config/database.js';
import { getGroupBalances } from '../engines/ledger.engine.js';
import budgetsRepository from '../repositories/budgets.repository.js';

const reportsService = {
  async getSummary(groupId) {
    const { rows: expenseStats } = await query(
      `SELECT COUNT(*) as total_expenses, COALESCE(SUM(amount), 0) as total_amount
       FROM expenses WHERE group_id = $1 AND deleted_at IS NULL AND status = 'active' AND is_draft = false`,
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
                 SELECT SUM(
                   CASE
                     WHEN EXISTS (SELECT 1 FROM expense_payers ep WHERE ep.expense_id = e.id) THEN (
                       SELECT COALESCE(SUM(ep.amount), 0) FROM expense_payers ep WHERE ep.expense_id = e.id AND ep.member_id = gm.id
                     )
                     ELSE e.amount
                   END
                 )
                 FROM expenses e
                 WHERE (e.paid_by_member_id = gm.id OR EXISTS (SELECT 1 FROM expense_payers ep WHERE ep.expense_id = e.id AND ep.member_id = gm.id))
                   AND e.deleted_at IS NULL AND e.status = 'active' AND e.is_draft = false
               ), 0) as total_paid,
               COALESCE((
                 SELECT SUM(ep.share_amount)
                 FROM expense_participants ep
                 JOIN expenses e ON e.id = ep.expense_id
                 WHERE ep.member_id = gm.id AND ep.deleted_at IS NULL AND e.deleted_at IS NULL AND e.status = 'active' AND e.is_draft = false
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
              COUNT(*)::INTEGER as expense_count,
              SUM(amount)::NUMERIC(14,2) as total_amount
       FROM expenses
       WHERE group_id = $1 AND deleted_at IS NULL AND status = 'active' AND is_draft = false
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
              COUNT(*)::INTEGER as expense_count,
              SUM(e.amount)::NUMERIC(14,2) as total_amount
       FROM expenses e
       LEFT JOIN expense_categories pc ON pc.id = e.category_id
       WHERE e.group_id = $1 AND e.deleted_at IS NULL AND e.status = 'active' AND e.is_draft = false
       GROUP BY pc.name
       ORDER BY total_amount DESC`,
      [groupId]
    );
    return rows.map((r) => ({ ...r, total_amount: parseFloat(r.total_amount) }));
  },

  async getYearlyReport(groupId) {
    const { rows } = await query(
      `SELECT EXTRACT(YEAR FROM expense_date)::INTEGER as year,
              COUNT(*)::INTEGER as expense_count,
              SUM(amount)::NUMERIC(14,2) as total_amount
       FROM expenses
       WHERE group_id = $1 AND deleted_at IS NULL AND status = 'active' AND is_draft = false
       GROUP BY EXTRACT(YEAR FROM expense_date)
       ORDER BY year DESC`,
      [groupId]
    );
    return rows.map((r) => ({ ...r, total_amount: parseFloat(r.total_amount) }));
  },

  async getSpendingTrends(groupId, months = 6) {
    const { rows } = await query(
      `SELECT TO_CHAR(expense_date, 'YYYY-MM') as month,
              COUNT(*)::INTEGER as expense_count,
              SUM(amount)::NUMERIC(14,2) as total_amount
       FROM expenses
       WHERE group_id = $1 AND deleted_at IS NULL AND status = 'active' AND is_draft = false
         AND expense_date >= NOW() - INTERVAL '1 month' * $2
       GROUP BY TO_CHAR(expense_date, 'YYYY-MM')
       ORDER BY month ASC`,
      [groupId, months]
    );

    const trends = rows.map((r) => ({
      month: r.month,
      expenseCount: r.expense_count,
      totalAmount: parseFloat(r.total_amount),
    }));

    for (let i = 0; i < trends.length; i++) {
      if (i === 0) {
        trends[i].changePercentage = 0;
      } else {
        const prev = trends[i - 1].totalAmount;
        const curr = trends[i].totalAmount;
        trends[i].changePercentage = prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(2)) : 0;
      }
    }

    const totalSpent = trends.reduce((s, t) => s + t.totalAmount, 0);
    const averageSpend = trends.length > 0 ? parseFloat((totalSpent / trends.length).toFixed(2)) : 0;

    return { trends, averageSpend };
  },

  async getBudgetReport(groupId) {
    const budgets = await budgetsRepository.findActiveByGroup(groupId);
    return budgets.map(b => {
      const limit = parseFloat(b.amount_limit);
      const spent = parseFloat(b.spent_amount) || 0;
      const remaining = parseFloat((limit - spent).toFixed(2));
      const percentage = limit > 0 ? parseFloat(((spent / limit) * 100).toFixed(2)) : 0;
      let status = 'on-track';
      const threshold = b.alert_threshold_pct || 80;
      if (percentage >= 100) status = 'exceeded';
      else if (percentage >= threshold) status = 'warning';

      return {
        id: b.id,
        name: b.name,
        budgetType: b.budget_type,
        limit,
        spent,
        remaining,
        percentage,
        status,
        categoryName: b.category_name,
        memberName: b.member_name,
      };
    });
  },

  async getSavingsAnalysis(groupId) {
    const budgets = await budgetsRepository.findActiveByGroup(groupId);
    let totalLimit = 0;
    let totalSpent = 0;
    const categorySavings = {};

    budgets.forEach(b => {
      const limit = parseFloat(b.amount_limit);
      const spent = parseFloat(b.spent_amount) || 0;
      totalLimit += limit;
      totalSpent += spent;

      const catName = b.category_name || 'Group-wide';
      if (!categorySavings[catName]) {
        categorySavings[catName] = { limit: 0, spent: 0, savings: 0 };
      }
      categorySavings[catName].limit += limit;
      categorySavings[catName].spent += spent;
    });

    Object.keys(categorySavings).forEach(cat => {
      const diff = categorySavings[cat].limit - categorySavings[cat].spent;
      categorySavings[cat].savings = parseFloat(diff.toFixed(2));
    });

    const totalSavings = parseFloat((totalLimit - totalSpent).toFixed(2));

    return {
      totalBudgetLimit: totalLimit,
      totalSpent,
      totalSavings,
      savingsPercentage: totalLimit > 0 ? parseFloat((totalSavings / totalLimit * 100).toFixed(2)) : 0,
      categorySavings,
    };
  },
};

export default reportsService;
