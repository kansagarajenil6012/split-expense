import budgetsService from '../services/budgets.service.js';
import { success, created, paginated, noContent } from '../utils/api-response.js';

export const getBudgets = async (req, res, next) => {
  try {
    const result = await budgetsService.getBudgets(req.groupId, req.query);
    paginated(res, result.budgets, {
      page: parseInt(req.query.page || 1),
      limit: parseInt(req.query.limit || 20),
      total: result.total,
    });
  } catch (err) { next(err); }
};

export const getBudget = async (req, res, next) => {
  try {
    const budget = await budgetsService.getBudget(req.groupId, req.params.budgetId);
    success(res, budget);
  } catch (err) { next(err); }
};

export const getActiveBudgets = async (req, res, next) => {
  try {
    const budgets = await budgetsService.getActiveBudgets(req.groupId);
    success(res, budgets);
  } catch (err) { next(err); }
};

export const createBudget = async (req, res, next) => {
  try {
    const budget = await budgetsService.createBudget(req.groupId, req.user.id, req.validated.body, req);
    created(res, budget);
  } catch (err) { next(err); }
};

export const updateBudget = async (req, res, next) => {
  try {
    const budget = await budgetsService.updateBudget(req.groupId, req.params.budgetId, req.user.id, req.validated.body, req);
    success(res, budget);
  } catch (err) { next(err); }
};

export const deleteBudget = async (req, res, next) => {
  try {
    await budgetsService.deleteBudget(req.groupId, req.params.budgetId, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const checkAlerts = async (req, res, next) => {
  try {
    const alerts = await budgetsService.checkBudgetAlerts(req.groupId);
    success(res, alerts);
  } catch (err) { next(err); }
};

export const restoreBudget = async (req, res, next) => {
  try {
    const budget = await budgetsService.restoreBudget(req.groupId, req.params.budgetId, req.user.id, req);
    success(res, budget);
  } catch (err) { next(err); }
};
