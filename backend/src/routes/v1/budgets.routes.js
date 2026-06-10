import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import { validate } from '../../middleware/validate-request.js';
import { createBudgetSchema, updateBudgetSchema, budgetIdSchema } from '../../validators/budgets.validator.js';
import * as budgetsController from '../../controllers/budgets.controller.js';

const router = Router({ mergeParams: true });

router.get('/', authenticate, authorizeGroup(), budgetsController.getBudgets);
router.get('/active', authenticate, authorizeGroup(), budgetsController.getActiveBudgets);
router.get('/alerts', authenticate, authorizeGroup(), budgetsController.checkAlerts);
router.get('/:budgetId', authenticate, authorizeGroup(), budgetsController.getBudget);
router.post('/', authenticate, authorizeGroup('admin'), validate(createBudgetSchema), budgetsController.createBudget);
router.patch('/:budgetId', authenticate, authorizeGroup('admin'), validate(updateBudgetSchema), budgetsController.updateBudget);
router.delete('/:budgetId', authenticate, authorizeGroup('admin'), validate(budgetIdSchema), budgetsController.deleteBudget);
router.post('/:budgetId/restore', authenticate, authorizeGroup('admin'), validate(budgetIdSchema), budgetsController.restoreBudget);

export default router;
