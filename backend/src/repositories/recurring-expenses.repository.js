import { query } from '../config/database.js';

const recurringExpensesRepository = {
  async findByGroupId(groupId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT re.*, u.full_name as created_by_name, ec.name as category_name,
              pm.id as paid_by_id, pu.full_name as paid_by_name
       FROM recurring_expenses re
       JOIN users u ON u.id = re.created_by
       LEFT JOIN expense_categories ec ON ec.id = re.category_id
       LEFT JOIN group_members pm ON pm.id = re.paid_by_member_id
       LEFT JOIN users pu ON pu.id = pm.user_id
       WHERE re.group_id = $1 AND re.deleted_at IS NULL
       ORDER BY re.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM recurring_expenses WHERE group_id = $1 AND deleted_at IS NULL`,
      [groupId]
    );
    return { items: rows, total: parseInt(countRows[0].count, 10) };
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT re.*, u.full_name as created_by_name, ec.name as category_name,
              pu.full_name as paid_by_name
       FROM recurring_expenses re
       JOIN users u ON u.id = re.created_by
       LEFT JOIN expense_categories ec ON ec.id = re.category_id
       LEFT JOIN group_members pm ON pm.id = re.paid_by_member_id
       LEFT JOIN users pu ON pu.id = pm.user_id
       WHERE re.id = $1 AND re.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findDueItems() {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await query(
      `SELECT re.* FROM recurring_expenses re
       WHERE re.is_active = true AND re.deleted_at IS NULL AND re.next_run_at <= $1`,
      [today]
    );
    return rows;
  },

  async create(data) {
    const { rows } = await query(
      `INSERT INTO recurring_expenses (group_id, template_title, amount, currency, category_id, paid_by_member_id, split_type, split_config, frequency, interval_count, next_run_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        data.groupId, data.templateTitle, data.amount, data.currency,
        data.categoryId || null, data.paidByMemberId, data.splitType,
        JSON.stringify(data.splitConfig || {}), data.frequency,
        data.intervalCount || 1, data.nextRunAt, data.createdBy,
      ]
    );
    return rows[0];
  },

  async update(id, data) {
    const { rows } = await query(
      `UPDATE recurring_expenses SET template_title=$1, amount=$2, category_id=$3, paid_by_member_id=$4, split_type=$5, split_config=$6, frequency=$7, interval_count=$8, next_run_at=$9, is_active=$10, updated_at=NOW()
       WHERE id=$11 AND deleted_at IS NULL RETURNING *`,
      [
        data.templateTitle, data.amount, data.categoryId || null,
        data.paidByMemberId, data.splitType, JSON.stringify(data.splitConfig || {}),
        data.frequency, data.intervalCount || 1, data.nextRunAt,
        data.isActive !== undefined ? data.isActive : true, id,
      ]
    );
    return rows[0];
  },

  async updateNextRun(id, nextRunAt, lastRunAt) {
    await query(
      `UPDATE recurring_expenses SET next_run_at = $1, last_run_at = $2, updated_at = NOW() WHERE id = $3`,
      [nextRunAt, lastRunAt, id]
    );
  },

  async softDelete(id) {
    const { rows } = await query(
      `UPDATE recurring_expenses SET deleted_at = NOW(), is_active = false WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },
};

export default recurringExpensesRepository;
