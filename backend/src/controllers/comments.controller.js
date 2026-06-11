import commentsService from '../services/comments.service.js';
import { success, created, noContent } from '../utils/api-response.js';

export const addComment = async (req, res, next) => {
  try {
    const { entityType, content, parentId } = req.body;
    const entityId = req.params.expenseId || req.body.entityId;
    const type = entityType || 'expense';
    const comment = await commentsService.addComment(
      type,
      entityId,
      req.groupId,
      req.user.id,
      content,
      parentId,
      req
    );
    created(res, comment);
  } catch (err) { next(err); }
};

export const getComments = async (req, res, next) => {
  try {
    const type = req.query.entityType || 'expense';
    const id = req.params.expenseId || req.query.entityId;
    const comments = await commentsService.getComments(type, id);
    success(res, comments);
  } catch (err) { next(err); }
};

export const updateComment = async (req, res, next) => {
  try {
    const comment = await commentsService.updateComment(
      req.params.commentId,
      req.user.id,
      req.body.content
    );
    success(res, comment);
  } catch (err) { next(err); }
};

export const deleteComment = async (req, res, next) => {
  try {
    await commentsService.deleteComment(req.params.commentId, req.user.id);
    noContent(res);
  } catch (err) { next(err); }
};
