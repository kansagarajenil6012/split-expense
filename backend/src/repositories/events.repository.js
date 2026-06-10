import { query } from '../config/database.js';

const eventsRepository = {
  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO events (group_id, name, description, event_type, location, starts_at, ends_at, status, created_by, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.groupId, data.name, data.description || null, data.eventType || 'trip',
        data.location || null, data.startsAt || null, data.endsAt || null,
        data.status || 'planned', data.createdBy, JSON.stringify(data.settings || {})
      ]
    );
    return rows[0];
  },

  async findByGroupId(groupId) {
    const { rows } = await query(
      `SELECT e.*, u.full_name as created_by_name
       FROM events e
       JOIN users u ON u.id = e.created_by
       WHERE e.group_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.starts_at ASC, e.created_at DESC`,
      [groupId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT e.*, u.full_name as created_by_name
       FROM events e
       JOIN users u ON u.id = e.created_by
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async update(id, data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE events SET name = $1, description = $2, event_type = $3, location = $4,
                         starts_at = $5, ends_at = $6, status = $7, settings = $8, updated_at = NOW()
       WHERE id = $9 AND deleted_at IS NULL
       RETURNING *`,
      [
        data.name, data.description, data.eventType, data.location,
        data.startsAt, data.endsAt, data.status, JSON.stringify(data.settings || {}),
        id
      ]
    );
    return rows[0];
  },

  async softDelete(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `UPDATE events SET deleted_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },

  // Attendance methods
  async saveAttendance(eventId, attendanceList, client = null) {
    const q = client ? client.query.bind(client) : query;
    // Delete existing attendance records for the event in the transaction
    await q(`DELETE FROM event_attendance WHERE event_id = $1`, [eventId]);

    if (attendanceList.length === 0) return [];

    const results = [];
    for (const att of attendanceList) {
      const { rows } = await q(
        `INSERT INTO event_attendance (event_id, member_id, attended, meals_count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id, member_id)
         DO UPDATE SET attended = EXCLUDED.attended, meals_count = EXCLUDED.meals_count
         RETURNING *`,
        [eventId, att.memberId, att.attended !== false, att.mealsCount || 0]
      );
      results.push(rows[0]);
    }
    return results;
  },

  async getAttendance(eventId) {
    const { rows } = await query(
      `SELECT ea.*, u.full_name, gm.user_id
       FROM event_attendance ea
       JOIN group_members gm ON gm.id = ea.member_id
       JOIN users u ON u.id = gm.user_id
       WHERE ea.event_id = $1 AND gm.deleted_at IS NULL AND gm.status = 'active'`,
      [eventId]
    );
    return rows;
  }
};

export default eventsRepository;
