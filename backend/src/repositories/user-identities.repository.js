import { query } from '../config/database.js';

const userIdentitiesRepository = {
  async findByProvider(provider, providerUserId) {
    const { rows } = await query(
      `SELECT ui.*, u.email, u.full_name, u.avatar_url, u.deleted_at as user_deleted
       FROM user_identities ui
       JOIN users u ON u.id = ui.user_id
       WHERE ui.provider = $1 AND ui.provider_user_id = $2 AND ui.deleted_at IS NULL`,
      [provider, providerUserId]
    );
    return rows[0] || null;
  },

  async create({ userId, provider, providerUserId, providerEmail }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, provider, providerUserId, providerEmail]
    );
    return rows[0];
  },
};

export default userIdentitiesRepository;
