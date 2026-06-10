import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import * as corporateController from '../../controllers/corporate.controller.js';

const router = Router({ mergeParams: true });

// Departments
router.post('/departments', authenticate, authorizeGroup('admin'), corporateController.createDepartment);
router.get('/departments', authenticate, authorizeGroup(), corporateController.getDepartments);

// Cost Centers
router.post('/cost-centers', authenticate, authorizeGroup('admin'), corporateController.createCostCenter);
router.get('/cost-centers', authenticate, authorizeGroup(), corporateController.getCostCenters);

// Approvals & Manager Dashboard
router.get('/manager/pending', authenticate, authorizeGroup('admin'), corporateController.getPendingExpenses);
router.patch('/expenses/:expenseId/approve', authenticate, authorizeGroup('admin'), corporateController.approveExpense);
router.patch('/expenses/:expenseId/reject', authenticate, authorizeGroup('admin'), corporateController.rejectExpense);

// Payroll Export
router.get('/payroll/export', authenticate, authorizeGroup('admin'), corporateController.getPayrollExport);

export default router;
