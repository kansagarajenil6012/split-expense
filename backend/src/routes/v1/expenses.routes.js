import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import { validate } from '../../middleware/validate-request.js';
import { uploadDocument } from '../../middleware/upload.middleware.js';
import {
  createExpenseSchema, updateExpenseSchema, expenseIdSchema,
  previewSplitSchema, commentSchema, reactionSchema
} from '../../validators/expenses.validator.js';
import * as expensesController from '../../controllers/expenses.controller.js';
import * as commentsController from '../../controllers/comments.controller.js';
import * as reactionsController from '../../controllers/reactions.controller.js';

const router = Router({ mergeParams: true });

router.post('/preview', authenticate, authorizeGroup(), validate(previewSplitSchema), expensesController.previewSplit);

router.post('/', authenticate, authorizeGroup(), validate(createExpenseSchema), expensesController.createExpense);
router.get('/', authenticate, authorizeGroup(), expensesController.getExpenses);
router.get('/:expenseId', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.getExpense);
router.patch('/:expenseId', authenticate, authorizeGroup(), validate(updateExpenseSchema), expensesController.updateExpense);
router.delete('/:expenseId', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.deleteExpense);
router.post('/:expenseId/restore', authenticate, authorizeGroup('admin'), validate(expenseIdSchema), expensesController.restoreExpense);

// Advanced Expense Features
router.patch('/:expenseId/publish', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.publishDraft);
router.get('/:expenseId/history', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.getExpenseHistory);

// Attachments
router.post('/:expenseId/attachments', authenticate, authorizeGroup(), validate(expenseIdSchema), uploadDocument, expensesController.uploadAttachment);
router.delete('/:expenseId/attachments/:id', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.deleteAttachment);
router.get('/:expenseId/attachments', authenticate, authorizeGroup(), validate(expenseIdSchema), expensesController.getAttachments);

// Comments
router.post('/:expenseId/comments', authenticate, authorizeGroup(), validate(commentSchema), commentsController.addComment);
router.get('/:expenseId/comments', authenticate, authorizeGroup(), commentsController.getComments);
router.patch('/comments/:commentId', authenticate, authorizeGroup(), commentsController.updateComment);
router.delete('/comments/:commentId', authenticate, authorizeGroup(), commentsController.deleteComment);

// Reactions
router.post('/:expenseId/reactions', authenticate, authorizeGroup(), validate(reactionSchema), reactionsController.toggleReaction);
router.get('/:expenseId/reactions', authenticate, authorizeGroup(), reactionsController.getReactions);

export default router;
