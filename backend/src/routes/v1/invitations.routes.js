import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as groupsController from '../../controllers/groups.controller.js';

const router = Router();

router.post('/:token/accept', authenticate, groupsController.acceptInvitation);

export default router;
