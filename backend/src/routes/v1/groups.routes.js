import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import { validate } from '../../middleware/validate-request.js';
import {
  createGroupSchema, updateGroupSchema, groupIdSchema,
  inviteSchema, updateMemberSchema, memberIdSchema,
} from '../../validators/groups.validator.js';
import * as groupsController from '../../controllers/groups.controller.js';

const router = Router();

router.post('/', authenticate, validate(createGroupSchema), groupsController.createGroup);
router.get('/', authenticate, groupsController.getGroups);
router.get('/:groupId', authenticate, validate(groupIdSchema), authorizeGroup(), groupsController.getGroup);
router.patch('/:groupId', authenticate, validate(updateGroupSchema), authorizeGroup({ requireAdmin: true }), groupsController.updateGroup);
router.delete('/:groupId', authenticate, validate(groupIdSchema), authorizeGroup({ requireAdmin: true }), groupsController.deleteGroup);

router.get('/:groupId/members', authenticate, validate(groupIdSchema), authorizeGroup(), groupsController.getMembers);
router.patch('/:groupId/members/:memberId', authenticate, validate(updateMemberSchema), authorizeGroup({ requireAdmin: true }), groupsController.updateMember);
router.delete('/:groupId/members/:memberId', authenticate, validate(memberIdSchema), authorizeGroup({ requireAdmin: true }), groupsController.removeMember);
router.post('/:groupId/leave', authenticate, validate(groupIdSchema), authorizeGroup(), groupsController.leaveGroup);

router.post('/:groupId/invitations', authenticate, validate(inviteSchema), authorizeGroup(), groupsController.inviteMember);
router.get('/:groupId/invitations', authenticate, validate(groupIdSchema), authorizeGroup(), groupsController.getInvitations);
router.post('/:groupId/share-link', authenticate, authorizeGroup({ requireAdmin: true }), groupsController.generateShareLink);

export default router;
