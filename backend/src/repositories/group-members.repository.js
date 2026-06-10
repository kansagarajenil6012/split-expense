import { query } from '../config/database.js';

const groupMembersRepository = {
  async findActiveMembership(groupId, userId) {
    const { rows } = await query(
      `SELECT gm.*, u.full_name, u.email, u.avatar_url
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.user_id = $2
         AND gm.status = 'active' AND gm.deleted_at IS NULL`,
      [groupId, userId]
    );
    return rows[0] || null;
  },

  async findById(memberId) {
    const { rows } = await query(
      `SELECT gm.*, u.full_name, u.email, u.avatar_url
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.id = $1 AND gm.deleted_at IS NULL`,
      [memberId]
    );
    return rows[0] || null;
  },

  async findByGroupId(groupId) {
    const { rows } = await query(
      `SELECT gm.*, u.full_name, u.email, u.avatar_url
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.status = 'active' AND gm.deleted_at IS NULL
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );
    return rows;
  },

  async create({ groupId, userId, role = 'member', invitedBy = null }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO group_members (group_id, user_id, role, status, joined_at, invited_by)
       VALUES ($1, $2, $3, 'active', NOW(), $4) RETURNING *`,
      [groupId, userId, role, invitedBy]
    );
    return rows[0];
  },

  async updateRole(memberId, role) {
    const { rows } = await query(
      `UPDATE group_members SET role = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [role, memberId]
    );
    return rows[0];
  },

  async remove(memberId) {
    const { rows } = await query(
      `UPDATE group_members SET status = 'removed', left_at = NOW(), deleted_at = NOW()
       WHERE id = $1 RETURNING *`,
      [memberId]
    );
    return rows[0];
  },

  async leave(memberId) {
    const { rows } = await query(
      `UPDATE group_members SET status = 'left', left_at = NOW(), deleted_at = NOW()
       WHERE id = $1 RETURNING *`,
      [memberId]
    );
    return rows[0];
  },

  async countAdmins(groupId) {
    const { rows } = await query(
      `SELECT COUNT(*) as count FROM group_members
       WHERE group_id = $1 AND role = 'admin' AND status = 'active' AND deleted_at IS NULL`,
      [groupId]
    );
    return parseInt(rows[0].count, 10);
  },
};

export default groupMembersRepository;
