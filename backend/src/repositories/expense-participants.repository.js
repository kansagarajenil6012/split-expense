import { query } from '../config/database.js';

const expenseParticipantsRepository = {
  async findByExpenseId(expenseId) {
    const { rows } = await query(
      `SELECT ep.*, u.full_name, u.email, u.avatar_url, gm.user_id
       FROM expense_participants ep
       JOIN group_members gm ON gm.id = ep.member_id
       JOIN users u ON u.id = gm.user_id
       WHERE ep.expense_id = $1 AND ep.deleted_at IS NULL`,
      [expenseId]
    );
    return rows;
  },

  async createMany(participants, client = null) {
    const q = client ? client.query.bind(client) : query;
    const results = [];
    for (const p of participants) {
      const { rows } = await q(
        `INSERT INTO expense_participants (expense_id, member_id, share_amount, share_percentage, share_units, is_included)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [p.expenseId, p.memberId, p.shareAmount, p.sharePercentage || null, p.shareUnits || null, p.isIncluded !== false]
      );
      results.push(rows[0]);
    }
    return results;
  },

  async softDeleteByExpenseId(expenseId, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q(`UPDATE expense_participants SET deleted_at = NOW() WHERE expense_id = $1`, [expenseId]);
  },

  async restoreByExpenseId(expenseId, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q(`UPDATE expense_participants SET deleted_at = NULL WHERE expense_id = $1`, [expenseId]);
  },
};

export default expenseParticipantsRepository;
