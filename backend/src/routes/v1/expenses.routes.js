import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import { validate } from '../../middleware/validate-request.js';
import { createExpenseSchema, updateExpenseSchema, expenseIdSchema } from '../../validators/expenses.validator.js';
import * as expensesController from '../../controllers/expenses.controller.js';

const router = Router({ mergeParams: true });

router.post('/', authenticate, authorizeGroup(), validate(createExpenseSchema), expensesController.createExpense);
router.get('/', authenticate, authorizeGroup(), expensesController.getExpenses);
router.get('/:expenseId', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.getExpense);
router.patch('/:expenseId', authenticate, authorizeGroup(), validate(updateExpenseSchema), expensesController.updateExpense);
router.delete('/:expenseId', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.deleteExpense);
router.post('/:expenseId/restore', authenticate, authorizeGroup('admin'), validate(expenseIdSchema), expensesController.restoreExpense);

export default router;
