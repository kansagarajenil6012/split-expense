import { query } from '../config/database.js';
import crypto from 'crypto';

const invitationsRepository = {
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  },

  async create({ groupId, invitedBy, inviteeEmail, inviteeUserId = null, expiresInDays = 7 }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const { rows } = await q(
      `INSERT INTO group_invitations (group_id, invited_by, invitee_email, invitee_user_id, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [groupId, invitedBy, inviteeEmail ? inviteeEmail.toLowerCase() : null, inviteeUserId, token, expiresAt]
    );
    return rows[0];
  },

  async findByToken(token) {
    const { rows } = await query(
      `SELECT gi.*, g.name as group_name, u.full_name as inviter_name
       FROM group_invitations gi
       JOIN groups g ON g.id = gi.group_id
       JOIN users u ON u.id = gi.invited_by
       WHERE gi.token = $1 AND gi.deleted_at IS NULL`,
      [token]
    );
    return rows[0] || null;
  },

  async findByGroupId(groupId) {
    const { rows } = await query(
      `SELECT * FROM group_invitations
       WHERE group_id = $1 AND status = 'pending' AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [groupId]
    );
    return rows;
  },

  async findPendingByEmail(email) {
    if (!email) return [];
    const { rows } = await query(
      `SELECT * FROM group_invitations
       WHERE invitee_email = $1 AND status = 'pending' AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [email.toLowerCase()]
    );
    return rows;
  },

  async updateStatus(id, status) {
    const { rows } = await query(
      `UPDATE group_invitations SET status = $1, responded_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  },
};

export default invitationsRepository;
