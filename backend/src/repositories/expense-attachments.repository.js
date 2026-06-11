import { query } from '../config/database.js';

const expenseAttachmentsRepository = {
  async create(data, client = null) {
    const exec = client || { query: query };
    const { rows } = await exec.query(
      `INSERT INTO expense_attachments (expense_id, file_url, file_name, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.expenseId, data.fileUrl, data.fileName, data.fileType, data.fileSize, data.uploadedBy]
    );
    return rows[0];
  },

  async findByExpenseId(expenseId) {
    const { rows } = await query(
      `SELECT ea.*, u.full_name as uploader_name
       FROM expense_attachments ea
       JOIN users u ON u.id = ea.uploaded_by
       WHERE ea.expense_id = $1 AND ea.deleted_at IS NULL
       ORDER BY ea.created_at DESC`,
      [expenseId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT * FROM expense_attachments WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async softDelete(id, client = null) {
    const exec = client || { query: query };
    const { rows } = await exec.query(
      `UPDATE expense_attachments SET deleted_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  async softDeleteByExpenseId(expenseId, client = null) {
    const exec = client || { query: query };
    await exec.query(
      `UPDATE expense_attachments SET deleted_at = NOW() WHERE expense_id = $1 AND deleted_at IS NULL`,
      [expenseId]
    );
  },
};

export default expenseAttachmentsRepository;
