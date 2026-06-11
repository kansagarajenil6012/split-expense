import { query } from '../config/database.js';

const expensePayersRepository = {
  async createMany(payers, client = null) {
    const exec = client || { query: query };
    const results = [];
    for (const p of payers) {
      const { rows } = await exec.query(
        `INSERT INTO expense_payers (expense_id, member_id, amount)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [p.expenseId, p.memberId, p.amount]
      );
      results.push(rows[0]);
    }
    return results;
  },

  async findByExpenseId(expenseId) {
    const { rows } = await query(
      `SELECT ep.*, gm.user_id, u.full_name
       FROM expense_payers ep
       JOIN group_members gm ON gm.id = ep.member_id
       JOIN users u ON u.id = gm.user_id
       WHERE ep.expense_id = $1 AND ep.deleted_at IS NULL
       ORDER BY ep.amount DESC`,
      [expenseId]
    );
    return rows;
  },

  async softDeleteByExpenseId(expenseId, client = null) {
    const exec = client || { query: query };
    await exec.query(
      `UPDATE expense_payers SET deleted_at = NOW() WHERE expense_id = $1 AND deleted_at IS NULL`,
      [expenseId]
    );
  },
};

export default expensePayersRepository;
