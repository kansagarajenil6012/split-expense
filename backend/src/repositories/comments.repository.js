import { query } from '../config/database.js';

const commentsRepository = {
  async create(data, client = null) {
    const exec = client || { query: query };
    const { rows } = await exec.query(
      `INSERT INTO comments (entity_type, entity_id, group_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.entityType, data.entityId, data.groupId, data.userId, data.content, data.parentId || null]
    );
    return rows[0];
  },

  async findByEntity(entityType, entityId) {
    const { rows } = await query(
      `SELECT c.*, u.full_name, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.entity_type = $1 AND c.entity_id = $2 AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC`,
      [entityType, entityId]
    );

    // Build threaded structure
    const commentMap = new Map();
    const rootComments = [];

    for (const comment of rows) {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    }

    for (const comment of rows) {
      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        commentMap.get(comment.parent_id).replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    }

    return rootComments;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async update(id, content, client = null) {
    const exec = client || { query: query };
    const { rows } = await exec.query(
      `UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [content, id]
    );
    return rows[0] || null;
  },

  async softDelete(id, client = null) {
    const exec = client || { query: query };
    const { rows } = await exec.query(
      `UPDATE comments SET deleted_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  async countByEntity(entityType, entityId) {
    const { rows } = await query(
      `SELECT COUNT(*)::int as count FROM comments WHERE entity_type = $1 AND entity_id = $2 AND deleted_at IS NULL`,
      [entityType, entityId]
    );
    return rows[0].count;
  },
};

export default commentsRepository;
