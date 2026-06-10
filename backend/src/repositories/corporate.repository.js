import { query } from '../config/database.js';

const corporateRepository = {
  // Departments
  async createDepartment(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO departments (group_id, name, manager_member_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.groupId, data.name, data.managerMemberId || null]
    );
    return rows[0];
  },

  async getDepartmentsByGroupId(groupId) {
    const { rows } = await query(
      `SELECT d.*, u.full_name as manager_name
       FROM departments d
       LEFT JOIN group_members gm ON gm.id = d.manager_member_id
       LEFT JOIN users u ON u.id = gm.user_id
       WHERE d.group_id = $1
       ORDER BY d.created_at DESC`,
      [groupId]
    );
    return rows;
  },

  // Teams
  async createTeam(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO teams (department_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [data.departmentId, data.name]
    );
    return rows[0];
  },

  async getTeamsByDepartmentId(deptId) {
    const { rows } = await query(
      `SELECT * FROM teams WHERE department_id = $1 ORDER BY created_at DESC`,
      [deptId]
    );
    return rows;
  },

  // Cost Centers
  async createCostCenter(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows } = await q(
      `INSERT INTO cost_centers (group_id, code, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.groupId, data.code, data.name]
    );
    return rows[0];
  },

  async getCostCentersByGroupId(groupId) {
    const { rows } = await query(
      `SELECT * FROM cost_centers WHERE group_id = $1 ORDER BY code ASC`,
      [groupId]
    );
    return rows;
  },

  // Companies & Branches
  async findOrCreateCompany(name, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows: existing } = await q(`SELECT * FROM companies WHERE name = $1`, [name]);
    if (existing[0]) return existing[0];

    const { rows } = await q(
      `INSERT INTO companies (name) VALUES ($1) RETURNING *`,
      [name]
    );
    return rows[0];
  },

  async findOrCreateBranch(companyId, name, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { rows: existing } = await q(`SELECT * FROM branches WHERE company_id = $1 AND name = $2`, [companyId, name]);
    if (existing[0]) return existing[0];

    const { rows } = await q(
      `INSERT INTO branches (company_id, name) VALUES ($1, $2) RETURNING *`,
      [companyId, name]
    );
    return rows[0];
  }
};

export default corporateRepository;
