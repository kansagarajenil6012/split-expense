import reactionsService from '../services/reactions.service.js';
import { success } from '../utils/api-response.js';

export const toggleReaction = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const result = await reactionsService.toggleReaction(
      req.params.expenseId,
      req.user.id,
      emoji,
      req.groupId,
      req
    );
    success(res, result);
  } catch (err) { next(err); }
};

export const getReactions = async (req, res, next) => {
  try {
    const reactions = await reactionsService.getReactions(req.params.expenseId);
    success(res, reactions);
  } catch (err) { next(err); }
};
