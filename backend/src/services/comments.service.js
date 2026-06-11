import commentsRepository from '../repositories/comments.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import { notFound, forbidden } from '../utils/app-error.js';
import { logActivity, getRequestMeta } from './audit.service.js';

const commentsService = {
  async addComment(entityType, entityId, groupId, userId, content, parentId, req) {
    const comment = await commentsRepository.create({
      entityType,
      entityId,
      groupId,
      userId,
      content,
      parentId,
    });

    // Log activity
    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'comment',
      entityId: comment.id,
      action: 'comment',
      summary: `Added a comment on ${entityType}`,
      payload: { content: content.substring(0, 100) },
      ...getRequestMeta(req),
    });

    // Notify group members (except commenter)
    if (groupId) {
      const members = await groupMembersRepository.findByGroupId(groupId);
      const notifications = members
        .filter((m) => m.user_id !== userId)
        .map((m) => ({
          userId: m.user_id,
          groupId,
          type: 'comment_added',
          title: 'New Comment',
          body: `New comment on ${entityType}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
          entityType,
          entityId,
        }));
      if (notifications.length) await notificationsRepository.createMany(notifications);
    }

    return comment;
  },

  async getComments(entityType, entityId) {
    return commentsRepository.findByEntity(entityType, entityId);
  },

  async updateComment(commentId, userId, content) {
    const comment = await commentsRepository.findById(commentId);
    if (!comment) throw notFound('Comment');
    if (comment.user_id !== userId) throw forbidden('You can only edit your own comments');

    return commentsRepository.update(commentId, content);
  },

  async deleteComment(commentId, userId) {
    const comment = await commentsRepository.findById(commentId);
    if (!comment) throw notFound('Comment');
    if (comment.user_id !== userId) throw forbidden('You can only delete your own comments');

    return commentsRepository.softDelete(commentId);
  },

  async getCommentCount(entityType, entityId) {
    return commentsRepository.countByEntity(entityType, entityId);
  },
};

export default commentsService;
