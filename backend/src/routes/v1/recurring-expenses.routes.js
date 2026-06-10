import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import { validate } from '../../middleware/validate-request.js';
import { createRecurringSchema, updateRecurringSchema, recurringIdSchema } from '../../validators/recurring-expenses.validator.js';
import * as controller from '../../controllers/recurring-expenses.controller.js';

const router = Router({ mergeParams: true });

router.get('/', authenticate, authorizeGroup(), controller.list);
router.get('/:recurringId', authenticate, authorizeGroup(), controller.get);
router.post('/', authenticate, authorizeGroup('admin'), validate(createRecurringSchema), controller.create);
router.patch('/:recurringId', authenticate, authorizeGroup('admin'), validate(updateRecurringSchema), controller.update);
router.delete('/:recurringId', authenticate, authorizeGroup('admin'), validate(recurringIdSchema), controller.remove);
router.post('/process', authenticate, controller.processDue);

export default router;
