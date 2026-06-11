import { getClient, query } from '../config/database.js';
import expensesRepository from '../repositories/expenses.repository.js';
import expenseParticipantsRepository from '../repositories/expense-participants.repository.js';
import ledgerRepository from '../repositories/ledger.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import expensePayersRepository from '../repositories/expense-payers.repository.js';
import expenseAttachmentsRepository from '../repositories/expense-attachments.repository.js';
import expenseItemsRepository from '../repositories/expense-items.repository.js';
import { uploadFile, deleteFile } from './upload.service.js';
import config from '../config/index.js';
import { calculateSplit } from './split-calculator.service.js';
import { buildExpenseLedgerEntries } from '../engines/ledger.engine.js';
import { notFound, badRequest } from '../utils/app-error.js';
import { logActivity, logAudit, getRequestMeta } from './audit.service.js';
import { getPagination } from '../utils/pagination.js';
import budgetsService from './budgets.service.js';

const expensesService = {
  async createExpense(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    // Duplicate Detection check
    if (!data.skipDuplicateCheck) {
      const duplicate = await query(
        `SELECT id, title, amount, expense_date FROM expenses
         WHERE group_id = $1 AND title = $2 AND amount = $3
           AND expense_date = $4 AND deleted_at IS NULL AND is_draft = false LIMIT 1`,
        [groupId, data.title, data.amount, data.expenseDate]
      );
      if (duplicate.rows.length > 0) {
        return {
          duplicateWarning: true,
          message: `An expense with title "${data.title}", amount "${data.amount}", and date "${data.expenseDate}" already exists in this group.`,
        };
      }
    }

    // Payers handling
    let primaryPayerId = data.paidByMemberId;
    if (data.payers && data.payers.length > 0) {
      const payersSum = data.payers.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      if (Math.abs(payersSum - parseFloat(data.amount)) > 0.01) {
        throw badRequest('Sum of payer amounts must equal total expense amount');
      }
      primaryPayerId = data.payers[0].memberId;
    } else {
      const paidByMember = await groupMembersRepository.findById(primaryPayerId);
      if (!paidByMember || paidByMember.group_id !== groupId) {
        throw badRequest('Invalid payer');
      }
    }

    // Split shares
    const shares = calculateSplit({
      splitType: data.splitType,
      totalAmount: data.amount,
      participants: data.participants,
      items: data.items,
      memberDays: data.memberDays,
      memberConsumption: data.memberConsumption,
      hybridConfig: data.hybridConfig,
    });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const isPendingApproval = data.approvalStatus === 'pending';
      const isDraft = data.isDraft || false;

      const expense = await expensesRepository.create({
        groupId,
        paidByMemberId: primaryPayerId,
        createdBy: userId,
        categoryId: data.categoryId,
        eventId: data.eventId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        currency: group.currency,
        expenseDate: data.expenseDate,
        splitType: data.splitType,
        notes: data.notes,
        costCenterId: data.costCenterId,
        projectName: data.projectName,
        approvalStatus: isPendingApproval ? 'pending' : 'approved',
        idempotencyKey: req.headers['idempotency-key'] || null,
        isDraft,
      }, client);

      const participants = await expenseParticipantsRepository.createMany(
        shares.map((s) => ({ ...s, expenseId: expense.id })),
        client
      );

      // Save multiple payers if provided
      if (data.payers && data.payers.length > 0) {
        await expensePayersRepository.createMany(
          data.payers.map(p => ({ expenseId: expense.id, memberId: p.memberId, amount: p.amount })),
          client
        );
      }

      // Save items and item participants for item-wise split
      if (data.splitType === 'item_wise' && data.items && data.items.length > 0) {
        const itemsToSave = data.items.map(item => {
          const itemAmount = parseFloat(item.amount);
          const itemParticipants = item.participants || [];
          const perPerson = Math.round((itemAmount / itemParticipants.length) * 100) / 100;
          return {
            expenseId: expense.id,
            name: item.name,
            amount: item.amount,
            quantity: item.quantity || 1,
            participants: itemParticipants.map((p, idx) => {
              const shareAmount = idx === itemParticipants.length - 1
                ? parseFloat((itemAmount - perPerson * (itemParticipants.length - 1)).toFixed(2))
                : perPerson;
              return { memberId: p.memberId, shareAmount };
            }),
          };
        });
        await expenseItemsRepository.createMany(itemsToSave, client);
      }

      // Create ledger entries and notifications only if NOT a draft and NOT pending approval
      if (!isDraft && !isPendingApproval) {
        const ledgerEntries = buildExpenseLedgerEntries({
          groupId,
          expenseId: expense.id,
          currency: group.currency,
          paidByMemberId: primaryPayerId,
          payers: data.payers,
          participants: shares,
          occurredAt: new Date(data.expenseDate),
        });
        await ledgerRepository.createEntries(ledgerEntries, client);
      }

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expense.id,
        action: 'create',
        summary: `Added ${isDraft ? 'draft ' : ''}expense "${expense.title}" for ${group.currency} ${expense.amount}`,
        payload: { amount: expense.amount, title: expense.title, isDraft },
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'expense.create',
        entityType: 'expense',
        entityId: expense.id,
        afterState: expense,
      }, client);

      if (!isDraft) {
        const members = await groupMembersRepository.findByGroupId(groupId);
        const notifications = members
          .filter((m) => m.user_id !== userId)
          .map((m) => ({
            userId: m.user_id,
            groupId,
            type: 'expense_added',
            title: 'New Expense',
            body: `New expense "${expense.title}" added to ${group.name}`,
            entityType: 'expense',
            entityId: expense.id,
          }));
        if (notifications.length) await notificationsRepository.createMany(notifications, client);
      }

      await client.query('COMMIT');

      if (!isDraft && !isPendingApproval) {
        budgetsService.checkBudgetAlerts(groupId).catch(console.error);
      }

      return { ...expense, participants };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateExpense(groupId, expenseId, userId, data, req) {
    const existing = await expensesRepository.findById(expenseId);
    if (!existing || existing.group_id !== groupId) throw notFound('Expense');

    const group = await groupsRepository.findById(groupId);
    const mergedData = {
      title: data.title ?? existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      amount: data.amount ?? parseFloat(existing.amount),
      expenseDate: data.expenseDate ?? existing.expense_date,
      paidByMemberId: data.paidByMemberId ?? existing.paid_by_member_id,
      categoryId: data.categoryId !== undefined ? data.categoryId : existing.category_id,
      splitType: data.splitType ?? existing.split_type,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      receiptUrl: data.receiptUrl ?? existing.receipt_url,
      eventId: data.eventId !== undefined ? data.eventId : existing.event_id,
      costCenterId: data.costCenterId !== undefined ? data.costCenterId : existing.cost_center_id,
      projectName: data.projectName !== undefined ? data.projectName : existing.project_name,
      approvalStatus: data.approvalStatus ?? existing.approval_status,
      is_draft: data.isDraft ?? existing.is_draft,
    };

    let primaryPayerId = mergedData.paidByMemberId;
    if (data.payers && data.payers.length > 0) {
      const payersSum = data.payers.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      if (Math.abs(payersSum - parseFloat(mergedData.amount)) > 0.01) {
        throw badRequest('Sum of payer amounts must equal total expense amount');
      }
      primaryPayerId = data.payers[0].memberId;
      mergedData.paidByMemberId = primaryPayerId;
    }

    const participants = data.participants ||
      (await expenseParticipantsRepository.findByExpenseId(expenseId)).map((p) => ({
        memberId: p.member_id,
        shareAmount: parseFloat(p.share_amount),
        sharePercentage: p.share_percentage ? parseFloat(p.share_percentage) : undefined,
        shareUnits: p.share_units ? parseFloat(p.share_units) : undefined,
        isIncluded: p.is_included,
      }));

    const shares = calculateSplit({
      splitType: mergedData.splitType,
      totalAmount: mergedData.amount,
      participants,
      items: data.items,
      memberDays: data.memberDays,
      memberConsumption: data.memberConsumption,
      hybridConfig: data.hybridConfig,
    });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Versioning / Revision Snapshotting
      const oldParticipants = await expenseParticipantsRepository.findByExpenseId(expenseId);
      const oldPayers = await expensePayersRepository.findByExpenseId(expenseId);
      const oldItems = await expenseItemsRepository.findByExpenseId(expenseId);
      const snapshot = {
        expense: existing,
        participants: oldParticipants,
        payers: oldPayers,
        items: oldItems,
      };

      const diff = {};
      for (const key in mergedData) {
        if (JSON.stringify(mergedData[key]) !== JSON.stringify(existing[key])) {
          diff[key] = { before: existing[key], after: mergedData[key] };
        }
      }

      const { rows: revRows } = await client.query(
        `SELECT COALESCE(MAX(revision_number), 0) as max_rev FROM entity_revisions WHERE entity_type = 'expense' AND entity_id = $1`,
        [expenseId]
      );
      const nextRev = revRows[0].max_rev + 1;

      await client.query(
        `INSERT INTO entity_revisions (entity_type, entity_id, revision_number, changed_by, change_reason, snapshot, diff)
         VALUES ('expense', $1, $2, $3, $4, $5, $6)`,
        [expenseId, nextRev, userId, data.changeReason || 'Update expense', JSON.stringify(snapshot), JSON.stringify(diff)]
      );

      // Void old ledger entries, participants, payers, and items
      await ledgerRepository.voidByReference('expense', expenseId, client);
      await expenseParticipantsRepository.softDeleteByExpenseId(expenseId, client);
      await expensePayersRepository.softDeleteByExpenseId(expenseId, client);
      await expenseItemsRepository.softDeleteByExpenseId(expenseId, client);

      // Update expense record (include mapping for camelCase isDraft -> snake_case is_draft)
      const updated = await expensesRepository.update(expenseId, mergedData, client);
      if (data.isDraft !== undefined) {
        await client.query(`UPDATE expenses SET is_draft = $1 WHERE id = $2`, [data.isDraft, expenseId]);
        updated.is_draft = data.isDraft;
      }

      // Create new participants
      const newParticipants = await expenseParticipantsRepository.createMany(
        shares.map((s) => ({ ...s, expenseId })),
        client
      );

      // Create new payers if provided
      if (data.payers && data.payers.length > 0) {
        await expensePayersRepository.createMany(
          data.payers.map(p => ({ expenseId, memberId: p.memberId, amount: p.amount })),
          client
        );
      }

      // Create new items if item_wise
      if (mergedData.splitType === 'item_wise' && data.items && data.items.length > 0) {
        const itemsToSave = data.items.map(item => {
          const itemAmount = parseFloat(item.amount);
          const itemParticipants = item.participants || [];
          const perPerson = Math.round((itemAmount / itemParticipants.length) * 100) / 100;
          return {
            expenseId,
            name: item.name,
            amount: item.amount,
            quantity: item.quantity || 1,
            participants: itemParticipants.map((p, idx) => {
              const shareAmount = idx === itemParticipants.length - 1
                ? parseFloat((itemAmount - perPerson * (itemParticipants.length - 1)).toFixed(2))
                : perPerson;
              return { memberId: p.memberId, shareAmount };
            }),
          };
        });
        await expenseItemsRepository.createMany(itemsToSave, client);
      }

      // Create new ledger entries ONLY IF NOT draft and IS approved
      if (!updated.is_draft && mergedData.approvalStatus === 'approved') {
        const ledgerEntries = buildExpenseLedgerEntries({
          groupId,
          expenseId,
          currency: group.currency,
          paidByMemberId: mergedData.paidByMemberId,
          payers: data.payers,
          participants: shares,
          occurredAt: new Date(mergedData.expenseDate),
        });
        await ledgerRepository.createEntries(ledgerEntries, client);
      }

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expenseId,
        action: 'update',
        summary: `Updated expense "${updated.title}" to ${group.currency} ${updated.amount}`,
        payload: { amount: updated.amount, title: updated.title },
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'expense.update',
        entityType: 'expense',
        entityId: expenseId,
        beforeState: existing,
        afterState: updated,
      }, client);

      if (!updated.is_draft) {
        const members = await groupMembersRepository.findByGroupId(groupId);
        const notifications = members
          .filter((m) => m.user_id !== userId)
          .map((m) => ({
            userId: m.user_id,
            groupId,
            type: 'expense_updated',
            title: 'Expense Updated',
            body: `Expense "${updated.title}" was updated in ${group.name}`,
            entityType: 'expense',
            entityId: expenseId,
          }));
        if (notifications.length) await notificationsRepository.createMany(notifications, client);
      }

      await client.query('COMMIT');
      return { ...updated, participants: newParticipants };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async publishDraft(groupId, expenseId, userId, req) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');
    if (!expense.is_draft) throw badRequest('Expense is already published');

    const group = await groupsRepository.findById(groupId);
    const shares = await expenseParticipantsRepository.findByExpenseId(expenseId);
    const payers = await expensePayersRepository.findByExpenseId(expenseId);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(`UPDATE expenses SET is_draft = false WHERE id = $1`, [expenseId]);

      if (expense.approval_status === 'approved') {
        const ledgerEntries = buildExpenseLedgerEntries({
          groupId,
          expenseId,
          currency: group.currency,
          paidByMemberId: expense.paid_by_member_id,
          payers: payers.length > 0 ? payers : null,
          participants: shares.map(s => ({ memberId: s.member_id, shareAmount: s.share_amount })),
          occurredAt: new Date(expense.expense_date),
        });
        await ledgerRepository.createEntries(ledgerEntries, client);
      }

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expenseId,
        action: 'approve',
        summary: `Published draft expense "${expense.title}"`,
        ...getRequestMeta(req),
      }, client);

      const members = await groupMembersRepository.findByGroupId(groupId);
      const notifications = members
        .filter((m) => m.user_id !== userId)
        .map((m) => ({
          userId: m.user_id,
          groupId,
          type: 'expense_added',
          title: 'New Expense',
          body: `New expense "${expense.title}" added to ${group.name}`,
          entityType: 'expense',
          entityId: expenseId,
        }));
      if (notifications.length) await notificationsRepository.createMany(notifications, client);

      await client.query('COMMIT');
      return { ...expense, is_draft: false };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async previewSplit(data) {
    const shares = calculateSplit({
      splitType: data.splitType,
      totalAmount: data.amount,
      participants: data.participants,
      items: data.items,
      memberDays: data.memberDays,
      memberConsumption: data.memberConsumption,
      hybridConfig: data.hybridConfig,
    });
    return shares;
  },

  async getExpenseHistory(groupId, expenseId) {
    const { rows } = await query(
      `SELECT er.*, u.full_name as changer_name
       FROM entity_revisions er
       LEFT JOIN users u ON u.id = er.changed_by
       WHERE er.entity_type = 'expense' AND er.entity_id = $1
       ORDER BY er.revision_number DESC`,
      [expenseId]
    );
    return rows;
  },

  async getExpenses(groupId, queryParams) {
    const { page, limit, offset } = getPagination(queryParams);
    const { expenses, total } = await expensesRepository.findByGroupId(groupId, {
      limit, offset,
      from: queryParams.from,
      to: queryParams.to,
      categoryId: queryParams.categoryId,
      memberId: queryParams.memberId,
    });

    const withParticipants = await Promise.all(
      expenses.map(async (e) => {
        const participants = await expenseParticipantsRepository.findByExpenseId(e.id);
        
        // Comment count
        const { rows: commentRows } = await query(
          `SELECT COUNT(*)::INTEGER as count FROM comments WHERE entity_type = 'expense' AND entity_id = $1 AND deleted_at IS NULL`,
          [e.id]
        );
        
        // Attachment count
        const { rows: attachRows } = await query(
          `SELECT COUNT(*)::INTEGER as count FROM expense_attachments WHERE expense_id = $1 AND deleted_at IS NULL`,
          [e.id]
        );
        
        // Reactions summary
        const { rows: reactRows } = await query(
          `SELECT emoji, COUNT(*)::INTEGER as count FROM expense_reactions WHERE expense_id = $1 GROUP BY emoji`,
          [e.id]
        );

        return {
          ...e,
          participants,
          comment_count: commentRows[0]?.count || 0,
          attachment_count: attachRows[0]?.count || 0,
          reactions: reactRows || [],
        };
      })
    );

    return { expenses: withParticipants, page, limit, total };
  },

  async getExpense(groupId, expenseId) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');
    const participants = await expenseParticipantsRepository.findByExpenseId(expenseId);
    const payers = await expensePayersRepository.findByExpenseId(expenseId);
    const items = await expenseItemsRepository.findByExpenseId(expenseId);
    const attachments = await expenseAttachmentsRepository.findByExpenseId(expenseId);
    return { ...expense, participants, payers, items, attachments };
  },

  async deleteExpense(groupId, expenseId, userId, req) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await expensesRepository.softDelete(expenseId, client);
      await expenseParticipantsRepository.softDeleteByExpenseId(expenseId, client);
      await ledgerRepository.voidByReference('expense', expenseId, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expenseId,
        action: 'void',
        summary: `Voided expense "${expense.title}"`,
        ...getRequestMeta(req),
      }, client);

      await client.query('COMMIT');
      return { id: expenseId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async restoreExpense(groupId, expenseId, userId, req) {
    const expense = await expensesRepository.findDeletedById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');

    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      const restored = await expensesRepository.restore(expenseId, client);
      await expenseParticipantsRepository.restoreByExpenseId(expenseId, client);

      const participants = await expenseParticipantsRepository.findByExpenseId(expenseId);

      const ledgerEntries = buildExpenseLedgerEntries({
        groupId,
        expenseId,
        currency: group.currency,
        paidByMemberId: expense.paid_by_member_id,
        participants: participants.map(p => ({
          memberId: p.member_id,
          shareAmount: parseFloat(p.share_amount),
        })),
        occurredAt: new Date(expense.expense_date),
      });
      await ledgerRepository.createEntries(ledgerEntries, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'expense',
        entityId: expenseId,
        action: 'restore',
        summary: `Restored expense "${expense.title}"`,
        payload: { amount: expense.amount, title: expense.title },
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'expense.restore',
        entityType: 'expense',
        entityId: expenseId,
        beforeState: { deleted: true },
        afterState: restored,
      }, client);

      await client.query('COMMIT');
      return restored;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Attachment methods
  async addAttachment(groupId, expenseId, userId, file, req) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');

    const filePath = `expenses/${expenseId}/${Date.now()}_${file.originalname}`;
    const fileUrl = await uploadFile(config.supabase.bucket, filePath, file.buffer, file.mimetype);

    const attachment = await expenseAttachmentsRepository.create({
      expenseId,
      fileUrl,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedBy: userId,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'attachment',
      entityId: attachment.id,
      action: 'create',
      summary: `Uploaded attachment "${file.originalname}" to expense "${expense.title}"`,
      ...getRequestMeta(req),
    });

    return attachment;
  },

  async deleteAttachment(groupId, expenseId, attachmentId, userId, req) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');

    const attachment = await expenseAttachmentsRepository.findById(attachmentId);
    if (!attachment || attachment.expense_id !== expenseId) throw notFound('Attachment');

    await expenseAttachmentsRepository.softDelete(attachmentId);

    // Extract filePath from URL to delete from storage
    // URL pattern: publicUrl/bucketName/filePath
    const fileUrlParts = attachment.file_url.split(`/${config.supabase.bucket}/`);
    if (fileUrlParts.length > 1) {
      const filePath = fileUrlParts[1];
      await deleteFile(config.supabase.bucket, filePath).catch(console.error);
    }

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'attachment',
      entityId: attachmentId,
      action: 'delete',
      summary: `Deleted attachment "${attachment.file_name}" from expense "${expense.title}"`,
      ...getRequestMeta(req),
    });

    return { id: attachmentId };
  },

  async getAttachments(groupId, expenseId) {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound('Expense');

    return expenseAttachmentsRepository.findByExpenseId(expenseId);
  },
};

export default expensesService;
