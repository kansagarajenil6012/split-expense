import { query } from '../config/database.js';

const ledgerRepository = {
  async createEntries(entries, client = null) {
    const q = client ? client.query.bind(client) : query;
    const results = [];
    for (const e of entries) {
      const { rows } = await q(
        `INSERT INTO ledger_entries (group_id, member_id, entry_type, amount, currency,
          reference_type, reference_id, description, occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [e.groupId, e.memberId, e.entryType, e.amount, e.currency,
         e.referenceType, e.referenceId, e.description || null, e.occurredAt || new Date()]
      );
      results.push(rows[0]);
    }
    return results;
  },

  async voidByReference(referenceType, referenceId, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q(
      `UPDATE ledger_entries SET deleted_at = NOW()
       WHERE reference_type = $1 AND reference_id = $2 AND deleted_at IS NULL`,
      [referenceType, referenceId]
    );
  },

  async getBalancesByGroupId(groupId) {
    const { rows } = await query(
      `SELECT gm.id as member_id, gm.user_id, u.full_name, u.avatar_url,
              COALESCE(SUM(le.amount), 0) as balance
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN ledger_entries le ON le.member_id = gm.id AND le.deleted_at IS NULL
       WHERE gm.group_id = $1 AND gm.status = 'active' AND gm.deleted_at IS NULL
       GROUP BY gm.id, gm.user_id, u.full_name, u.avatar_url
       ORDER BY balance DESC`,
      [groupId]
    );
    return rows.map((r) => ({ ...r, balance: parseFloat(r.balance) }));
  },

  async getEntriesByGroupId(groupId, { limit, offset }) {
    const { rows } = await query(
      `SELECT le.*, u.full_name as member_name
       FROM ledger_entries le
       JOIN group_members gm ON gm.id = le.member_id
       JOIN users u ON u.id = gm.user_id
       WHERE le.group_id = $1 AND le.deleted_at IS NULL
       ORDER BY le.occurred_at DESC LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM ledger_entries WHERE group_id = $1 AND deleted_at IS NULL`,
      [groupId]
    );
    return { entries: rows, total: parseInt(countRows[0].count, 10) };
  },
};

export default ledgerRepository;
