import { Router } from 'express';
import authRoutes from './v1/auth.routes.js';
import groupsRoutes from './v1/groups.routes.js';
import invitationsRoutes from './v1/invitations.routes.js';
import expensesRoutes from './v1/expenses.routes.js';
import settlementsRoutes, { balancesRouter, ledgerRouter } from './v1/settlements.routes.js';
import reportsRoutes from './v1/reports.routes.js';
import activityRoutes from './v1/activity.routes.js';
import notificationsRoutes from './v1/notifications.routes.js';
import usersRoutes from './v1/users.routes.js';
import budgetsRoutes from './v1/budgets.routes.js';
import recurringExpensesRoutes from './v1/recurring-expenses.routes.js';
import eventsRoutes from './v1/events.routes.js';
import corporateRoutes from './v1/corporate.routes.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeGroup } from '../middleware/authorize-group.js';
import * as expensesController from '../controllers/expenses.controller.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/groups', groupsRoutes);
router.use('/invitations', invitationsRoutes);
router.use('/notifications', notificationsRoutes);

router.use('/groups/:groupId/expenses', expensesRoutes);
router.use('/groups/:groupId/settlements', settlementsRoutes);
router.use('/groups/:groupId/balances', balancesRouter);
router.use('/groups/:groupId/ledger', ledgerRouter);
router.use('/groups/:groupId/reports', reportsRoutes);
router.use('/groups/:groupId/activity', activityRoutes);
router.use('/groups/:groupId/budgets', budgetsRoutes);
router.use('/groups/:groupId/recurring-expenses', recurringExpensesRoutes);
router.use('/groups/:groupId/events', eventsRoutes);
router.use('/groups/:groupId/corporate', corporateRoutes);
router.get('/groups/:groupId/categories', authenticate, authorizeGroup(), expensesController.getCategories);

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

export default router;
