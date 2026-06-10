import { query } from '../config/database.js';
import { sendPushNotification } from '../services/firebase.service.js';
import refreshTokensRepository from './refresh-tokens.repository.js';

const notificationsRepository = {
  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO notifications (user_id, group_id, type, title, body, entity_type, entity_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        data.userId, data.groupId || null, data.type, data.title, data.body,
        data.entityType || null, data.entityId || null, JSON.stringify(data.payload || {}),
      ]
    );
    const notification = rows[0];

    try {
      const fcmTokens = await refreshTokensRepository.findActiveFCMTokens(data.userId);
      for (const token of fcmTokens) {
        sendPushNotification(token, notification.title, notification.body, {
          entityType: notification.entity_type || '',
          entityId: notification.entity_id || '',
          type: notification.type,
        }).catch(console.error);
      }
    } catch (err) {
      console.error('Failed to send push notification:', err);
    }

    return notification;
  },

  async createMany(notifications, client = null) {
    const results = [];
    for (const n of notifications) {
      results.push(await this.create(n, client));
    }
    return results;
  },

  async findByUserId(userId, { limit, offset, unreadOnly = false }) {
    let sql = `SELECT * FROM notifications WHERE user_id = $1 AND deleted_at IS NULL`;
    if (unreadOnly) sql += ` AND is_read = false`;
    sql += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const { rows } = await query(sql, [userId, limit, offset]);
    return rows;
  },

  async getUnreadCount(userId) {
    const { rows } = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL`,
      [userId]
    );
    return parseInt(rows[0].count, 10);
  },

  async markRead(id, userId) {
    const { rows } = await query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    return rows[0];
  },

  async markAllRead(userId) {
    await query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
  },

  async softDelete(id, userId) {
    const { rows } = await query(
      `UPDATE notifications SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    return rows[0];
  },
};

export default notificationsRepository;
