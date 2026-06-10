import { query } from '../config/database.js';

const usersRepository = {
  async findById(id) {
    const { rows } = await query(
      `SELECT id, email, password_hash, full_name, avatar_url, phone,
              default_currency, timezone, email_verified_at, is_active,
              last_login_at, metadata, created_at, updated_at, deleted_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    if (!email) return null;
    const { rows } = await query(
      `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    return rows[0] || null;
  },

  async findByPhone(phone) {
    if (!phone) return null;
    // Strip non-digits and use the last 10 digits for flexible matching
    const digitsOnly = phone.replace(/\D/g, '');
    let searchPattern = phone;
    if (digitsOnly.length >= 10) {
      searchPattern = '%' + digitsOnly.slice(-10);
    }
    
    const { rows } = await query(
      `SELECT * FROM users WHERE phone LIKE $1 AND deleted_at IS NULL LIMIT 1`,
      [searchPattern]
    );
    return rows[0] || null;
  },

  async create({ email, passwordHash, fullName, avatarUrl = null, phone = null }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO users (email, password_hash, full_name, avatar_url, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, avatar_url, phone, default_currency, timezone, created_at`,
      [email ? email.toLowerCase() : null, passwordHash, fullName, avatarUrl, phone]
    );
    return rows[0];
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['full_name', 'avatar_url', 'phone', 'default_currency', 'timezone'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const { rows } = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, email, full_name, avatar_url, phone, default_currency, timezone, created_at, updated_at`,
      values
    );
    return rows[0];
  },

  async updateLastLogin(id) {
    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [id]);
  },

  async softDelete(id) {
    const { rows } = await query(
      `UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0];
  },

  toPublic(user) {
    if (!user) return null;
    const { password_hash, deleted_at, ...publicUser } = user;
    return publicUser;
  },
};

export default usersRepository;
