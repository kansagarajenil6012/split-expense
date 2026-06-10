import corporateService from '../services/corporate.service.js';
import { success, created } from '../utils/api-response.js';

export const createDepartment = async (req, res, next) => {
  try {
    const dept = await corporateService.createDepartment(req.groupId, req.user.id, req.body);
    created(res, dept);
  } catch (err) { next(err); }
};

export const getDepartments = async (req, res, next) => {
  try {
    const depts = await corporateService.getDepartments(req.groupId);
    success(res, depts);
  } catch (err) { next(err); }
};

export const createCostCenter = async (req, res, next) => {
  try {
    const cc = await corporateService.createCostCenter(req.groupId, req.user.id, req.body);
    created(res, cc);
  } catch (err) { next(err); }
};

export const getCostCenters = async (req, res, next) => {
  try {
    const ccs = await corporateService.getCostCenters(req.groupId);
    success(res, ccs);
  } catch (err) { next(err); }
};

export const getPendingExpenses = async (req, res, next) => {
  try {
    const expenses = await corporateService.getPendingExpenses(req.groupId);
    success(res, expenses);
  } catch (err) { next(err); }
};

export const approveExpense = async (req, res, next) => {
  try {
    const result = await corporateService.approveExpense(req.groupId, req.params.expenseId, req.user.id, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const rejectExpense = async (req, res, next) => {
  try {
    const result = await corporateService.rejectExpense(req.groupId, req.params.expenseId, req.user.id, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const getPayrollExport = async (req, res, next) => {
  try {
    const csvContent = await corporateService.getPayrollExport(req.groupId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-export-${req.groupId}.csv`);
    res.status(200).send(csvContent);
  } catch (err) { next(err); }
};
