import { query } from '../config/database.js';

const expenseItemsRepository = {
  async createMany(items, client = null) {
    const exec = client || { query: query };
    const results = [];
    for (const item of items) {
      const { rows } = await exec.query(
        `INSERT INTO expense_items (expense_id, name, amount, quantity)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [item.expenseId, item.name, item.amount, item.quantity || 1]
      );
      const createdItem = rows[0];

      // Create item participants
      if (item.participants && item.participants.length > 0) {
        for (const p of item.participants) {
          await exec.query(
            `INSERT INTO expense_item_participants (item_id, member_id, share_amount)
             VALUES ($1, $2, $3)`,
            [createdItem.id, p.memberId, p.shareAmount]
          );
        }
      }

      results.push(createdItem);
    }
    return results;
  },

  async findByExpenseId(expenseId) {
    const { rows: items } = await query(
      `SELECT * FROM expense_items WHERE expense_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [expenseId]
    );

    for (const item of items) {
      const { rows: participants } = await query(
        `SELECT eip.*, gm.user_id, u.full_name
         FROM expense_item_participants eip
         JOIN group_members gm ON gm.id = eip.member_id
         JOIN users u ON u.id = gm.user_id
         WHERE eip.item_id = $1`,
        [item.id]
      );
      item.participants = participants;
    }

    return items;
  },

  async softDeleteByExpenseId(expenseId, client = null) {
    const exec = client || { query: query };
    await exec.query(
      `UPDATE expense_items SET deleted_at = NOW() WHERE expense_id = $1 AND deleted_at IS NULL`,
      [expenseId]
    );
  },
};

export default expenseItemsRepository;
