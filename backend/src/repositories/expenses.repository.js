import { query } from '../config/database.js';

const expensesRepository = {
  async findById(id) {
    const { rows } = await query(
      `SELECT e.*,
              u.full_name as created_by_name,
              pc.name as category_name,
              pm.id as paid_by_id,
              pu.full_name as paid_by_name
       FROM expenses e
       JOIN users u ON u.id = e.created_by
       JOIN group_members pm ON pm.id = e.paid_by_member_id
       JOIN users pu ON pu.id = pm.user_id
       LEFT JOIN expense_categories pc ON pc.id = e.category_id
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findByGroupId(groupId, { limit, offset, from, to, categoryId, memberId }) {
    let sql = `
      SELECT e.*, u.full_name as created_by_name, pu.full_name as paid_by_name, pc.name as category_name
      FROM expenses e
      JOIN users u ON u.id = e.created_by
      JOIN group_members pm ON pm.id = e.paid_by_member_id
      JOIN users pu ON pu.id = pm.user_id
      LEFT JOIN expense_categories pc ON pc.id = e.category_id
      WHERE e.group_id = $1 AND e.deleted_at IS NULL AND e.status = 'active'`;
    const params = [groupId];
    let i = 2;

    if (from) { sql += ` AND e.expense_date >= $${i++}`; params.push(from); }
    if (to) { sql += ` AND e.expense_date <= $${i++}`; params.push(to); }
    if (categoryId) { sql += ` AND e.category_id = $${i++}`; params.push(categoryId); }
    if (memberId) {
      sql += ` AND EXISTS (SELECT 1 FROM expense_participants ep WHERE ep.expense_id = e.id AND ep.member_id = $${i++} AND ep.deleted_at IS NULL)`;
      params.push(memberId);
    }

    sql += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT $${i++} OFFSET $${i}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM expenses e WHERE e.group_id = $1 AND e.deleted_at IS NULL AND e.status = 'active'`;
    const countParams = [groupId];
    const { rows: countRows } = await query(countSql, countParams);

    return { expenses: rows, total: parseInt(countRows[0].count, 10) };
  },

  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO expenses (group_id, paid_by_member_id, created_by, category_id, event_id, title, description,
        amount, currency, expense_date, split_type, receipt_url, notes, idempotency_key, cost_center_id, project_name, approval_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        data.groupId, data.paidByMemberId, data.createdBy, data.categoryId || null, data.eventId || null,
        data.title, data.description || null, data.amount, data.currency,
        data.expenseDate, data.splitType, data.receiptUrl || null,
        data.notes || null, data.idempotencyKey || null,
        data.costCenterId || null, data.projectName || null, data.approvalStatus || 'approved'
      ]
    );
    return rows[0];
  },

  async update(id, data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE expenses SET title=$1, description=$2, amount=$3, expense_date=$4,
        category_id=$5, paid_by_member_id=$6, split_type=$7, notes=$8, receipt_url=$9,
        event_id=$10, cost_center_id=$11, project_name=$12, approval_status=$13
       WHERE id=$14 AND deleted_at IS NULL RETURNING *`,
      [
        data.title, data.description, data.amount, data.expenseDate,
        data.categoryId, data.paidByMemberId, data.splitType,
        data.notes, data.receiptUrl, data.eventId || null,
        data.costCenterId || null, data.projectName || null, data.approvalStatus || 'approved',
        id,
      ]
    );
    return rows[0];
  },

  async softDelete(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE expenses SET deleted_at = NOW(), status = 'voided' WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },

  async findDeletedById(id) {
    const { rows } = await query(
      `SELECT e.*,
              u.full_name as created_by_name,
              pc.name as category_name,
              pm.id as paid_by_id,
              pu.full_name as paid_by_name
       FROM expenses e
       JOIN users u ON u.id = e.created_by
       JOIN group_members pm ON pm.id = e.paid_by_member_id
       JOIN users pu ON pu.id = pm.user_id
       LEFT JOIN expense_categories pc ON pc.id = e.category_id
       WHERE e.id = $1 AND e.deleted_at IS NOT NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async restore(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE expenses SET deleted_at = NULL, status = 'active' WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },
};

export default expensesRepository;
