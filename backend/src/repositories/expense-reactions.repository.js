import { query } from '../config/database.js';

const expenseReactionsRepository = {
  async toggle(expenseId, userId, emoji) {
    // Check if reaction exists
    const { rows: existing } = await query(
      `SELECT id FROM expense_reactions WHERE expense_id = $1 AND user_id = $2 AND emoji = $3`,
      [expenseId, userId, emoji]
    );

    if (existing.length > 0) {
      // Remove reaction
      await query(
        `DELETE FROM expense_reactions WHERE id = $1`,
        [existing[0].id]
      );
      return { added: false, emoji };
    } else {
      // Add reaction
      const { rows } = await query(
        `INSERT INTO expense_reactions (expense_id, user_id, emoji)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [expenseId, userId, emoji]
      );
      return { added: true, emoji, reaction: rows[0] };
    }
  },

  async findByExpenseId(expenseId) {
    const { rows } = await query(
      `SELECT er.emoji, 
              COUNT(*)::int as count,
              json_agg(json_build_object('userId', er.user_id, 'fullName', u.full_name)) as users
       FROM expense_reactions er
       JOIN users u ON u.id = er.user_id
       WHERE er.expense_id = $1
       GROUP BY er.emoji
       ORDER BY count DESC`,
      [expenseId]
    );
    return rows;
  },

  async findByExpenseIds(expenseIds) {
    if (!expenseIds.length) return {};
    const { rows } = await query(
      `SELECT er.expense_id, er.emoji, COUNT(*)::int as count
       FROM expense_reactions er
       WHERE er.expense_id = ANY($1)
       GROUP BY er.expense_id, er.emoji`,
      [expenseIds]
    );

    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.expense_id]) grouped[r.expense_id] = [];
      grouped[r.expense_id].push({ emoji: r.emoji, count: r.count });
    }
    return grouped;
  },
};

export default expenseReactionsRepository;
