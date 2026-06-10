import { query } from '../config/database.js';

const categoriesRepository = {
  async findSystem() {
    const { rows } = await query(
      `SELECT * FROM expense_categories WHERE is_system = true AND deleted_at IS NULL ORDER BY name`
    );
    return rows;
  },

  async findByGroupId(groupId) {
    const { rows } = await query(
      `SELECT * FROM expense_categories
       WHERE (group_id = $1 OR is_system = true) AND deleted_at IS NULL
       ORDER BY is_system DESC, name`,
      [groupId]
    );
    return rows;
  },

  async create({ groupId, name, icon, color }) {
    const { rows } = await query(
      `INSERT INTO expense_categories (group_id, name, icon, color) VALUES ($1,$2,$3,$4) RETURNING *`,
      [groupId, name, icon, color]
    );
    return rows[0];
  },
};

export default categoriesRepository;
