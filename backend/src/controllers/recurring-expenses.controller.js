import recurringExpensesService from '../services/recurring-expenses.service.js';
import { success, created, paginated, noContent } from '../utils/api-response.js';

export const list = async (req, res, next) => {
  try {
    const result = await recurringExpensesService.list(req.groupId, req.query);
    paginated(res, result.items, { page: parseInt(req.query.page || 1), limit: parseInt(req.query.limit || 20), total: result.total });
  } catch (err) { next(err); }
};

export const get = async (req, res, next) => {
  try {
    const item = await recurringExpensesService.get(req.groupId, req.params.recurringId);
    success(res, item);
  } catch (err) { next(err); }
};

export const create = async (req, res, next) => {
  try {
    const item = await recurringExpensesService.create(req.groupId, req.user.id, req.validated.body, req);
    created(res, item);
  } catch (err) { next(err); }
};

export const update = async (req, res, next) => {
  try {
    const item = await recurringExpensesService.update(req.groupId, req.params.recurringId, req.user.id, req.validated.body, req);
    success(res, item);
  } catch (err) { next(err); }
};

export const remove = async (req, res, next) => {
  try {
    await recurringExpensesService.delete(req.groupId, req.params.recurringId, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const processDue = async (req, res, next) => {
  try {
    const result = await recurringExpensesService.processDueItems();
    success(res, result);
  } catch (err) { next(err); }
};
