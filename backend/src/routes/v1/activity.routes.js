import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import * as expensesController from '../../controllers/expenses.controller.js';

const router = Router({ mergeParams: true });

router.get('/', authenticate, authorizeGroup(), expensesController.getGroupActivity);

export default router;
