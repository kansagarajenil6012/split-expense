import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import { validate } from '../../middleware/validate-request.js';
import { groupIdSchema } from '../../validators/groups.validator.js';
import {
  createSettlementSchema, settlementIdSchema,
  requestSettlementSchema, reverseSettlementSchema, sendReminderSchema
} from '../../validators/expenses.validator.js';
import * as expensesController from '../../controllers/expenses.controller.js';

const router = Router({ mergeParams: true });

router.get('/suggestions', authenticate, authorizeGroup(), expensesController.getSettlementSuggestions);
router.post('/', authenticate, authorizeGroup(), validate(createSettlementSchema), expensesController.createSettlement);
router.get('/', authenticate, authorizeGroup(), expensesController.getSettlements);
router.get('/:settlementId', authenticate, authorizeGroup(), expensesController.getSettlement);
router.patch('/:settlementId/cancel', authenticate, authorizeGroup(), validate(settlementIdSchema), expensesController.cancelSettlement);
router.post('/:settlementId/restore', authenticate, authorizeGroup('admin'), validate(settlementIdSchema), expensesController.restoreSettlement);

// Advanced Settlement Features
router.post('/request', authenticate, authorizeGroup(), validate(requestSettlementSchema), expensesController.requestSettlement);
router.patch('/:settlementId/approve', authenticate, authorizeGroup(), validate(settlementIdSchema), expensesController.approveSettlement);
router.patch('/:settlementId/reject', authenticate, authorizeGroup(), validate(settlementIdSchema), expensesController.rejectSettlement);
router.patch('/:settlementId/reverse', authenticate, authorizeGroup(), validate(reverseSettlementSchema), expensesController.reverseSettlement);
router.post('/remind', authenticate, authorizeGroup(), validate(sendReminderSchema), expensesController.sendReminder);

export default router;

const balancesRouter = Router({ mergeParams: true });
balancesRouter.get('/', authenticate, authorizeGroup(), expensesController.getBalances);

const ledgerRouter = Router({ mergeParams: true });
ledgerRouter.get('/', authenticate, authorizeGroup(), expensesController.getLedger);

export { balancesRouter, ledgerRouter };
