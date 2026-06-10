import { query } from '../config/database.js';

const auditLogsRepository = {
  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO audit_logs (request_id, actor_user_id, action, entity_type, entity_id,
        before_state, after_state, changed_fields, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        data.requestId, data.actorUserId || null, data.action, data.entityType, data.entityId,
        data.beforeState ? JSON.stringify(data.beforeState) : null,
        data.afterState ? JSON.stringify(data.afterState) : null,
        data.changedFields || null,
        data.ipAddress || null, data.userAgent || null,
      ]
    );
    return rows[0];
  },
};

export default auditLogsRepository;
