import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as expensesController from '../../controllers/expenses.controller.js';

const router = Router();

router.get('/', authenticate, expensesController.getNotifications);
router.get('/unread-count', authenticate, expensesController.getUnreadCount);
router.patch('/read-all', authenticate, expensesController.markAllRead);
router.patch('/:id/read', authenticate, expensesController.markNotificationRead);
router.delete('/:id', authenticate, expensesController.deleteNotification);

export default router;
