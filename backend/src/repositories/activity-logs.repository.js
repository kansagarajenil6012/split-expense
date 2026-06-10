import { query } from '../config/database.js';

const activityLogsRepository = {
  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO activity_logs (group_id, actor_user_id, entity_type, entity_id, action, summary, payload, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        data.groupId || null, data.actorUserId, data.entityType, data.entityId,
        data.action, data.summary, JSON.stringify(data.payload || {}),
        data.ipAddress || null, data.userAgent || null,
      ]
    );
    return rows[0];
  },

  async findByGroupId(groupId, { limit, offset, entityId }) {
    let q = `SELECT al.*, u.full_name as actor_name, u.avatar_url as actor_avatar
             FROM activity_logs al
             JOIN users u ON u.id = al.actor_user_id
             WHERE al.group_id = $1`;
    const params = [groupId];

    if (entityId) {
      params.push(entityId);
      q += ` AND al.entity_id = $2`;
    }

    q += ` ORDER BY al.occurred_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const { rows } = await query(q, [...params, limit, offset]);

    let countQ = `SELECT COUNT(*) FROM activity_logs WHERE group_id = $1`;
    const countParams = [groupId];
    if (entityId) {
      countParams.push(entityId);
      countQ += ` AND entity_id = $2`;
    }
    const { rows: countRows } = await query(countQ, countParams);

    return { activities: rows, total: parseInt(countRows[0].count, 10) };
  },

  async findByUserId(userId, { limit, offset }) {
    const { rows } = await query(
      `SELECT al.*, u.full_name as actor_name, g.name as group_name
       FROM activity_logs al
       JOIN users u ON u.id = al.actor_user_id
       LEFT JOIN groups g ON g.id = al.group_id
       WHERE al.actor_user_id = $1 OR al.group_id IN (
         SELECT group_id FROM group_members WHERE user_id = $1 AND status = 'active'
       )
       ORDER BY al.occurred_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },
};

export default activityLogsRepository;
