import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate-request.js';
import { updateProfileSchema } from '../../validators/expenses.validator.js';
import * as authController from '../../controllers/auth.controller.js';
import * as expensesController from '../../controllers/expenses.controller.js';

const router = Router();

router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), expensesController.updateProfile);
router.delete('/me', authenticate, expensesController.deleteAccount);
router.get('/me/activity', authenticate, expensesController.getUserActivity);

export default router;
