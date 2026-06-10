import { query } from '../config/database.js';

const groupsRepository = {
  async findById(id) {
    const { rows } = await query(
      `SELECT g.*, u.full_name as creator_name
       FROM groups g
       JOIN users u ON u.id = g.created_by
       WHERE g.id = $1 AND g.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT g.*, gm.role, gm.status, gm.joined_at,
              (SELECT COUNT(*) FROM group_members gm2
               WHERE gm2.group_id = g.id AND gm2.status = 'active' AND gm2.deleted_at IS NULL) as member_count,
              (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries le
               WHERE le.member_id = gm.id AND le.deleted_at IS NULL) as user_balance
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1 AND gm.status = 'active' AND gm.deleted_at IS NULL
         AND g.deleted_at IS NULL AND g.is_archived = false
       ORDER BY g.updated_at DESC`,
      [userId]
    );
    return rows;
  },

  async create({ name, description, groupType, currency, createdBy, settings = {} }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO groups (name, description, group_type, currency, created_by, settings)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, groupType || 'general', currency || 'INR', createdBy, JSON.stringify(settings)]
    );
    return rows[0];
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['name', 'description', 'group_type', 'currency', 'avatar_url', 'settings', 'is_archived'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(key === 'settings' ? JSON.stringify(data[key]) : data[key]);
      }
    }
    if (!fields.length) return this.findById(id);
    values.push(id);
    const { rows } = await query(
      `UPDATE groups SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0];
  },

  async softDelete(id) {
    const { rows } = await query(
      `UPDATE groups SET deleted_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0];
  },
};

export default groupsRepository;
