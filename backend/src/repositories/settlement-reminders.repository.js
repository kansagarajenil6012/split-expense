import { query } from '../config/database.js';

const settlementRemindersRepository = {
  async create(data, client = null) {
    const exec = client || { query: query };
    const { rows } = await exec.query(
      `INSERT INTO settlement_reminders (group_id, from_member_id, to_member_id, amount, message, sent_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.groupId, data.fromMemberId, data.toMemberId, data.amount, data.message, data.sentBy]
    );
    return rows[0];
  },

  async findByGroupId(groupId) {
    const { rows } = await query(
      `SELECT sr.*,
              fu.full_name as from_name,
              tu.full_name as to_name,
              su.full_name as sent_by_name
       FROM settlement_reminders sr
       JOIN group_members fm ON fm.id = sr.from_member_id
       JOIN users fu ON fu.id = fm.user_id
       JOIN group_members tm ON tm.id = sr.to_member_id
       JOIN users tu ON tu.id = tm.user_id
       JOIN users su ON su.id = sr.sent_by
       WHERE sr.group_id = $1
       ORDER BY sr.created_at DESC`,
      [groupId]
    );
    return rows;
  },
};

export default settlementRemindersRepository;
