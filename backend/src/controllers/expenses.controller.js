import expensesService from '../services/expenses.service.js';
import settlementsService from '../services/settlements.service.js';
import reportsService from '../services/reports.service.js';
import { usersService, activityService, notificationsService, categoriesService } from '../services/users.service.js';
import { success, created, paginated, noContent } from '../utils/api-response.js';

export const createExpense = async (req, res, next) => {
  try {
    const expense = await expensesService.createExpense(req.groupId, req.user.id, req.validated.body, req);
    created(res, expense);
  } catch (err) { next(err); }
};

export const getExpenses = async (req, res, next) => {
  try {
    const result = await expensesService.getExpenses(req.groupId, req.query);
    paginated(res, result.expenses, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) { next(err); }
};

export const getExpense = async (req, res, next) => {
  try {
    const expense = await expensesService.getExpense(req.groupId, req.params.expenseId);
    success(res, expense);
  } catch (err) { next(err); }
};

export const deleteExpense = async (req, res, next) => {
  try {
    await expensesService.deleteExpense(req.groupId, req.params.expenseId, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const updateExpense = async (req, res, next) => {
  try {
    const expense = await expensesService.updateExpense(req.groupId, req.params.expenseId, req.user.id, req.validated.body, req);
    success(res, expense);
  } catch (err) { next(err); }
};

export const cancelSettlement = async (req, res, next) => {
  try {
    const result = await settlementsService.cancelSettlement(req.groupId, req.params.settlementId, req.user.id, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const getBalances = async (req, res, next) => {
  try {
    const balances = await settlementsService.getBalances(req.groupId);
    success(res, balances);
  } catch (err) { next(err); }
};

export const getSuggestedSettlements = async (req, res, next) => {
  try {
    const suggestions = await settlementsService.getSuggestedSettlements(req.groupId);
    success(res, suggestions);
  } catch (err) { next(err); }
};

export const getLedger = async (req, res, next) => {
  try {
    const result = await settlementsService.getLedger(req.groupId, req.query);
    paginated(res, result.entries, { page: parseInt(req.query.page || 1), limit: parseInt(req.query.limit || 20), total: result.total });
  } catch (err) { next(err); }
};

export const getSettlementSuggestions = async (req, res, next) => {
  try {
    const suggestions = await settlementsService.getSuggestions(req.groupId);
    success(res, suggestions);
  } catch (err) { next(err); }
};

export const createSettlement = async (req, res, next) => {
  try {
    const settlement = await settlementsService.createSettlement(req.groupId, req.user.id, req.validated.body, req);
    created(res, settlement);
  } catch (err) { next(err); }
};

export const getSettlements = async (req, res, next) => {
  try {
    const result = await settlementsService.getSettlements(req.groupId, req.query);
    paginated(res, result.settlements, { page: parseInt(req.query.page || 1), limit: parseInt(req.query.limit || 20), total: result.total });
  } catch (err) { next(err); }
};

export const getSettlement = async (req, res, next) => {
  try {
    const settlement = await settlementsService.getSettlement(req.groupId, req.params.settlementId);
    success(res, settlement);
  } catch (err) { next(err); }
};

export const getSummary = async (req, res, next) => {
  try {
    const summary = await reportsService.getSummary(req.groupId);
    success(res, summary);
  } catch (err) { next(err); }
};

export const getMemberReport = async (req, res, next) => {
  try {
    const report = await reportsService.getMemberReport(req.groupId);
    success(res, report);
  } catch (err) { next(err); }
};

export const getMonthlyReport = async (req, res, next) => {
  try {
    const report = await reportsService.getMonthlyReport(req.groupId, req.query.year);
    success(res, report);
  } catch (err) { next(err); }
};

export const getCategoryReport = async (req, res, next) => {
  try {
    const report = await reportsService.getCategoryReport(req.groupId);
    success(res, report);
  } catch (err) { next(err); }
};

export const getGroupActivity = async (req, res, next) => {
  try {
    const result = await activityService.getGroupActivity(req.groupId, req.query);
    paginated(res, result.activities, { page: parseInt(req.query.page || 1), limit: parseInt(req.query.limit || 20), total: result.total });
  } catch (err) { next(err); }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await usersService.updateProfile(req.user.id, req.validated.body);
    success(res, user);
  } catch (err) { next(err); }
};

export const deleteAccount = async (req, res, next) => {
  try {
    await usersService.deleteAccount(req.user.id);
    noContent(res);
  } catch (err) { next(err); }
};

export const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationsService.getNotifications(req.user.id, req.query);
    success(res, result.notifications, 200, { page: result.page, limit: result.limit });
  } catch (err) { next(err); }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationsService.getUnreadCount(req.user.id);
    success(res, { count });
  } catch (err) { next(err); }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const n = await notificationsService.markRead(req.user.id, req.params.id);
    success(res, n);
  } catch (err) { next(err); }
};

export const markAllRead = async (req, res, next) => {
  try {
    await notificationsService.markAllRead(req.user.id);
    success(res, { message: 'All marked as read' });
  } catch (err) { next(err); }
};

export const deleteNotification = async (req, res, next) => {
  try {
    await notificationsService.deleteNotification(req.user.id, req.params.id);
    noContent(res);
  } catch (err) { next(err); }
};

export const getCategories = async (req, res, next) => {
  try {
    const categories = await categoriesService.getCategories(req.params.groupId);
    success(res, categories);
  } catch (err) { next(err); }
};

export const getUserActivity = async (req, res, next) => {
  try {
    const activities = await activityService.getUserActivity(req.user.id, req.query);
    success(res, activities);
  } catch (err) { next(err); }
};

export const restoreExpense = async (req, res, next) => {
  try {
    const expense = await expensesService.restoreExpense(req.groupId, req.params.expenseId, req.user.id, req);
    success(res, expense);
  } catch (err) { next(err); }
};

export const restoreSettlement = async (req, res, next) => {
  try {
    const settlement = await settlementsService.restoreSettlement(req.groupId, req.params.settlementId, req.user.id, req);
    success(res, settlement);
  } catch (err) { next(err); }
};

export const previewSplit = async (req, res, next) => {
  try {
    const shares = await expensesService.previewSplit(req.validated.body);
    success(res, shares);
  } catch (err) { next(err); }
};

export const publishDraft = async (req, res, next) => {
  try {
    const expense = await expensesService.publishDraft(req.groupId, req.params.expenseId, req.user.id, req);
    success(res, expense);
  } catch (err) { next(err); }
};

export const getExpenseHistory = async (req, res, next) => {
  try {
    const history = await expensesService.getExpenseHistory(req.groupId, req.params.expenseId);
    success(res, history);
  } catch (err) { next(err); }
};

export const uploadAttachment = async (req, res, next) => {
  try {
    const attachment = await expensesService.addAttachment(req.groupId, req.params.expenseId, req.user.id, req.file, req);
    created(res, attachment);
  } catch (err) { next(err); }
};

export const deleteAttachment = async (req, res, next) => {
  try {
    await expensesService.deleteAttachment(req.groupId, req.params.expenseId, req.params.id, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const getAttachments = async (req, res, next) => {
  try {
    const attachments = await expensesService.getAttachments(req.groupId, req.params.expenseId);
    success(res, attachments);
  } catch (err) { next(err); }
};

export const requestSettlement = async (req, res, next) => {
  try {
    const settlement = await settlementsService.requestSettlement(req.groupId, req.user.id, req.validated.body, req);
    created(res, settlement);
  } catch (err) { next(err); }
};

export const approveSettlement = async (req, res, next) => {
  try {
    const settlement = await settlementsService.approveSettlement(req.groupId, req.params.settlementId, req.user.id, req);
    success(res, settlement);
  } catch (err) { next(err); }
};

export const rejectSettlement = async (req, res, next) => {
  try {
    const settlement = await settlementsService.rejectSettlement(req.groupId, req.params.settlementId, req.user.id, req);
    success(res, settlement);
  } catch (err) { next(err); }
};

export const reverseSettlement = async (req, res, next) => {
  try {
    const settlement = await settlementsService.reverseSettlement(req.groupId, req.params.settlementId, req.user.id, req.body.reason, req);
    success(res, settlement);
  } catch (err) { next(err); }
};

export const sendReminder = async (req, res, next) => {
  try {
    const reminder = await settlementsService.sendReminder(req.groupId, req.user.id, req.validated.body, req);
    created(res, reminder);
  } catch (err) { next(err); }
};

export const getYearlyReport = async (req, res, next) => {
  try {
    const report = await reportsService.getYearlyReport(req.groupId);
    success(res, report);
  } catch (err) { next(err); }
};

export const getSpendingTrends = async (req, res, next) => {
  try {
    const report = await reportsService.getSpendingTrends(req.groupId, req.query.months ? parseInt(req.query.months) : 6);
    success(res, report);
  } catch (err) { next(err); }
};

export const getBudgetReport = async (req, res, next) => {
  try {
    const report = await reportsService.getBudgetReport(req.groupId);
    success(res, report);
  } catch (err) { next(err); }
};

export const getSavingsAnalysis = async (req, res, next) => {
  try {
    const report = await reportsService.getSavingsAnalysis(req.groupId);
    success(res, report);
  } catch (err) { next(err); }
};
