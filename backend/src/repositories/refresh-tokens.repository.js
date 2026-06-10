import { query } from '../config/database.js';
import crypto from 'crypto';

const refreshTokensRepository = {
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  async create({ userId, token, expiresAt, deviceInfo = {} }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const tokenHash = this.hashToken(token);
    const { rows } = await q(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, tokenHash, expiresAt, JSON.stringify(deviceInfo)]
    );
    return rows[0];
  },

  async findValid(token) {
    const tokenHash = this.hashToken(token);
    const { rows } = await query(
      `SELECT rt.*, u.id as user_id, u.email, u.full_name, u.is_active, u.deleted_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async revoke(token) {
    const tokenHash = this.hashToken(token);
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );
  },

  async revokeAllForUser(userId) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  },

  async findActiveFCMTokens(userId) {
    const { rows } = await query(
      `SELECT DISTINCT fcm_token FROM refresh_tokens 
       WHERE user_id = $1 AND fcm_token IS NOT NULL 
       AND revoked_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
    return rows.map(r => r.fcm_token);
  },

  async updateFCMToken(refreshToken, fcmToken) {
    const tokenHash = this.hashToken(refreshToken);
    await query(
      `UPDATE refresh_tokens SET fcm_token = $1 WHERE token_hash = $2 AND revoked_at IS NULL`,
      [fcmToken, tokenHash]
    );
  },
};

export default refreshTokensRepository;
