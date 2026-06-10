import { query } from '../config/database.js';

const budgetsRepository = {
  async findByGroupId(groupId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT b.*, u.full_name as created_by_name, ec.name as category_name,
              COALESCE((
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE e.group_id = b.group_id
                  AND e.deleted_at IS NULL
                  AND e.status = 'active'
                  AND (b.category_id IS NULL OR e.category_id = b.category_id)
                  AND e.expense_date >= b.period_start
                  AND e.expense_date <= b.period_end
              ), 0) as spent_amount
       FROM budgets b
       JOIN users u ON u.id = b.created_by
       LEFT JOIN expense_categories ec ON ec.id = b.category_id
       WHERE b.group_id = $1 AND b.deleted_at IS NULL
       ORDER BY b.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM budgets WHERE group_id = $1 AND deleted_at IS NULL`,
      [groupId]
    );

    return { budgets: rows, total: parseInt(countRows[0].count, 10) };
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT b.*, u.full_name as created_by_name, ec.name as category_name,
              COALESCE((
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE e.group_id = b.group_id
                  AND e.deleted_at IS NULL
                  AND e.status = 'active'
                  AND (b.category_id IS NULL OR e.category_id = b.category_id)
                  AND e.expense_date >= b.period_start
                  AND e.expense_date <= b.period_end
              ), 0) as spent_amount
       FROM budgets b
       JOIN users u ON u.id = b.created_by
       LEFT JOIN expense_categories ec ON ec.id = b.category_id
       WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findActiveByGroup(groupId) {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await query(
      `SELECT b.*, ec.name as category_name,
              COALESCE((
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE e.group_id = b.group_id
                  AND e.deleted_at IS NULL
                  AND e.status = 'active'
                  AND (b.category_id IS NULL OR e.category_id = b.category_id)
                  AND e.expense_date >= b.period_start
                  AND e.expense_date <= b.period_end
              ), 0) as spent_amount
       FROM budgets b
       LEFT JOIN expense_categories ec ON ec.id = b.category_id
       WHERE b.group_id = $1 AND b.deleted_at IS NULL
         AND b.period_start <= $2 AND b.period_end >= $2
       ORDER BY b.created_at DESC`,
      [groupId, today]
    );
    return rows;
  },

  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO budgets (group_id, category_id, name, amount_limit, currency, period, period_start, period_end, alert_threshold_pct, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.groupId, data.categoryId || null, data.name, data.amountLimit,
        data.currency, data.period, data.periodStart, data.periodEnd,
        data.alertThresholdPct || 80, data.createdBy,
      ]
    );
    return rows[0];
  },

  async update(id, data) {
    const { rows } = await query(
      `UPDATE budgets SET name=$1, amount_limit=$2, category_id=$3, period=$4, period_start=$5, period_end=$6, alert_threshold_pct=$7, updated_at=NOW()
       WHERE id=$8 AND deleted_at IS NULL RETURNING *`,
      [data.name, data.amountLimit, data.categoryId || null, data.period, data.periodStart, data.periodEnd, data.alertThresholdPct || 80, id]
    );
    return rows[0];
  },

  async softDelete(id) {
    const { rows } = await query(
      `UPDATE budgets SET deleted_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },

  async findDeletedById(id) {
    const { rows } = await query(
      `SELECT b.*, u.full_name as created_by_name, ec.name as category_name,
              COALESCE((
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE e.group_id = b.group_id
                  AND e.deleted_at IS NULL
                  AND e.status = 'active'
                  AND (b.category_id IS NULL OR e.category_id = b.category_id)
                  AND e.expense_date >= b.period_start
                  AND e.expense_date <= b.period_end
              ), 0) as spent_amount
       FROM budgets b
       JOIN users u ON u.id = b.created_by
       LEFT JOIN expense_categories ec ON ec.id = b.category_id
       WHERE b.id = $1 AND b.deleted_at IS NOT NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async restore(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE budgets SET deleted_at = NULL WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },
};

export default budgetsRepository;
