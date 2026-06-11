import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import * as expensesController from '../../controllers/expenses.controller.js';

const router = Router({ mergeParams: true });

router.get('/summary', authenticate, authorizeGroup(), expensesController.getSummary);
router.get('/members', authenticate, authorizeGroup(), expensesController.getMemberReport);
router.get('/monthly', authenticate, authorizeGroup(), expensesController.getMonthlyReport);
router.get('/categories', authenticate, authorizeGroup(), expensesController.getCategoryReport);

// Advanced Reports
router.get('/yearly', authenticate, authorizeGroup(), expensesController.getYearlyReport);
router.get('/trends', authenticate, authorizeGroup(), expensesController.getSpendingTrends);
router.get('/budget-report', authenticate, authorizeGroup(), expensesController.getBudgetReport);
router.get('/savings', authenticate, authorizeGroup(), expensesController.getSavingsAnalysis);

export default router;
