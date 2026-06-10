import groupMembersRepository from '../repositories/group-members.repository.js';
import { forbidden, notFound } from '../utils/app-error.js';

export const authorizeGroup = (options = {}) => {
  const { requireAdmin = false } = options;

  return async (req, res, next) => {
    try {
      const groupId = req.params.groupId || req.body.groupId;
      if (!groupId) return next(notFound('Group'));

      const membership = await groupMembersRepository.findActiveMembership(groupId, req.user.id);
      if (!membership) return next(forbidden('You are not a member of this group'));

      if (requireAdmin && membership.role !== 'admin') {
        return next(forbidden('Admin access required'));
      }

      req.membership = membership;
      req.groupId = groupId;
      next();
    } catch (err) {
      next(err);
    }
  };
};
