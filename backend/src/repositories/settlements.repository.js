import { query } from '../config/database.js';

const settlementsRepository = {
  async findById(id) {
    const { rows } = await query(
      `SELECT s.*,
              fu.full_name as from_name, tu.full_name as to_name,
              ru.full_name as recorded_by_name
       FROM settlements s
       JOIN group_members fm ON fm.id = s.from_member_id
       JOIN users fu ON fu.id = fm.user_id
       JOIN group_members tm ON tm.id = s.to_member_id
       JOIN users tu ON tu.id = tm.user_id
       JOIN users ru ON ru.id = s.recorded_by
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findByGroupId(groupId, { limit, offset, status }) {
    let sql = `SELECT s.*, fu.full_name as from_name, tu.full_name as to_name
               FROM settlements s
               JOIN group_members fm ON fm.id = s.from_member_id
               JOIN users fu ON fu.id = fm.user_id
               JOIN group_members tm ON tm.id = s.to_member_id
               JOIN users tu ON tu.id = tm.user_id
               WHERE s.group_id = $1 AND s.deleted_at IS NULL`;
    const params = [groupId];
    if (status) { sql += ` AND s.status = $2`; params.push(status); }
    sql += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM settlements WHERE group_id = $1 AND deleted_at IS NULL`,
      [groupId]
    );
    return { settlements: rows, total: parseInt(countRows[0].count, 10) };
  },

  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO settlements (group_id, from_member_id, to_member_id, amount, currency,
        status, method, notes, recorded_by, is_suggested, settled_at,
        is_partial, parent_settlement_id, requested_by, approved_by, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        data.groupId, data.fromMemberId, data.toMemberId, data.amount, data.currency,
        data.status || 'completed', data.method || null, data.notes || null,
        data.recordedBy, data.isSuggested || false,
        data.status === 'completed' ? new Date() : null,
        data.isPartial || false, data.parentSettlementId || null,
        data.requestedBy || null, data.approvedBy || null, data.approvedAt || null
      ]
    );
    return rows[0];
  },

  async updateStatus(id, status, client = null) {
    const q = client ? client.query.bind(client) : query;
    const settledAt = status === 'completed' ? new Date() : null;
    const { rows } = await q(
      `UPDATE settlements SET status = $1, settled_at = COALESCE($2, settled_at) WHERE id = $3 RETURNING *`,
      [status, settledAt, id]
    );
    return rows[0];
  },

  async approve(id, approvedBy, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE settlements
       SET status = 'completed', approved_by = $1, approved_at = NOW(), settled_at = NOW()
       WHERE id = $2 AND status = 'requested' AND deleted_at IS NULL RETURNING *`,
      [approvedBy, id]
    );
    return rows[0];
  },

  async reject(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE settlements SET status = 'rejected' WHERE id = $1 AND status = 'requested' AND deleted_at IS NULL RETURNING *`,
      [id]
    );
    return rows[0];
  },

  async reverse(id, { reversedBy, reversalReason }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE settlements
       SET status = 'reversed', reversed_by = $1, reversal_reason = $2, reversed_at = NOW()
       WHERE id = $3 AND status = 'completed' AND deleted_at IS NULL RETURNING *`,
      [reversedBy, reversalReason, id]
    );
    return rows[0];
  },

  async softDelete(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE settlements SET deleted_at = NOW(), status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },

  async findDeletedById(id) {
    const { rows } = await query(
      `SELECT s.*,
              fu.full_name as from_name, tu.full_name as to_name,
              ru.full_name as recorded_by_name
       FROM settlements s
       JOIN group_members fm ON fm.id = s.from_member_id
       JOIN users fu ON fu.id = fm.user_id
       JOIN group_members tm ON tm.id = s.to_member_id
       JOIN users tu ON tu.id = tm.user_id
       LEFT JOIN users ru ON ru.id = s.recorded_by
       WHERE s.id = $1 AND (s.deleted_at IS NOT NULL OR s.status = 'cancelled')`,
      [id]
    );
    return rows[0] || null;
  },

  async restore(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE settlements SET deleted_at = NULL, status = 'completed', settled_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },
};

export default settlementsRepository;
