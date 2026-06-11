import { getClient } from '../config/database.js';
import settlementsRepository from '../repositories/settlements.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import ledgerRepository from '../repositories/ledger.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import settlementRemindersRepository from '../repositories/settlement-reminders.repository.js';
import { buildSettlementLedgerEntries, getGroupBalances } from '../engines/ledger.engine.js';
import { notFound, badRequest, forbidden } from '../utils/app-error.js';
import { logActivity, logAudit, getRequestMeta } from './audit.service.js';
import { getPagination } from '../utils/pagination.js';
import { optimizeSettlements } from '../engines/ledger.engine.js';

const settlementsService = {
  async getSuggestions(groupId) {
    const balances = await getGroupBalances(groupId);
    return optimizeSettlements(balances);
  },

  async getBalances(groupId) {
    return getGroupBalances(groupId);
  },

  async getLedger(groupId, query) {
    const { page, limit, offset } = getPagination(query);
    return ledgerRepository.getEntriesByGroupId(groupId, { limit, offset });
  },

  async createSettlement(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const fromMember = await groupMembersRepository.findById(data.fromMemberId);
    const toMember = await groupMembersRepository.findById(data.toMemberId);
    if (!fromMember || fromMember.group_id !== groupId) throw badRequest('Invalid from member');
    if (!toMember || toMember.group_id !== groupId) throw badRequest('Invalid to member');
    if (data.fromMemberId === data.toMemberId) throw badRequest('Cannot settle with yourself');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const settlement = await settlementsRepository.create({
        groupId,
        fromMemberId: data.fromMemberId,
        toMemberId: data.toMemberId,
        amount: data.amount,
        currency: group.currency,
        status: data.status || 'completed',
        method: data.method,
        notes: data.notes,
        recordedBy: userId,
        isSuggested: data.isSuggested || false,
        isPartial: data.isPartial || false,
        parentSettlementId: data.parentSettlementId || null,
      }, client);

      const ledgerEntries = buildSettlementLedgerEntries({
        groupId,
        settlementId: settlement.id,
        currency: group.currency,
        fromMemberId: data.fromMemberId,
        toMemberId: data.toMemberId,
        amount: data.amount,
        occurredAt: new Date(),
      });
      await ledgerRepository.createEntries(ledgerEntries, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'settlement',
        entityId: settlement.id,
        action: 'settle',
        summary: `Settlement of ${group.currency} ${data.amount} recorded`,
        ...getRequestMeta(req),
      }, client);

      if (toMember.user_id !== userId) {
        await notificationsRepository.create({
          userId: toMember.user_id,
          groupId,
          type: 'settlement_completed',
          title: 'Settlement Recorded',
          body: `A settlement of ${group.currency} ${data.amount} was recorded in ${group.name}`,
          entityType: 'settlement',
          entityId: settlement.id,
        }, client);
      }

      await client.query('COMMIT');
      return settlement;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async requestSettlement(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const fromMember = await groupMembersRepository.findById(data.fromMemberId);
    const toMember = await groupMembersRepository.findById(data.toMemberId);
    if (!fromMember || fromMember.group_id !== groupId) throw badRequest('Invalid from member');
    if (!toMember || toMember.group_id !== groupId) throw badRequest('Invalid to member');
    if (data.fromMemberId === data.toMemberId) throw badRequest('Cannot settle with yourself');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const settlement = await settlementsRepository.create({
        groupId,
        fromMemberId: data.fromMemberId,
        toMemberId: data.toMemberId,
        amount: data.amount,
        currency: group.currency,
        status: 'requested',
        method: data.method,
        notes: data.notes,
        recordedBy: userId,
        isSuggested: data.isSuggested || false,
        isPartial: data.isPartial || false,
        parentSettlementId: data.parentSettlementId || null,
        requestedBy: userId,
      }, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'settlement',
        entityId: settlement.id,
        action: 'request',
        summary: `Settlement request of ${group.currency} ${data.amount} created`,
        ...getRequestMeta(req),
      }, client);

      const notifyUserId = fromMember.user_id === userId ? toMember.user_id : fromMember.user_id;
      if (notifyUserId) {
        await notificationsRepository.create({
          userId: notifyUserId,
          groupId,
          type: 'settlement_request',
          title: 'Settlement Request',
          body: `A settlement of ${group.currency} ${data.amount} has been requested for your approval in "${group.name}"`,
          entityType: 'settlement',
          entityId: settlement.id,
        }, client);
      }

      await client.query('COMMIT');
      return settlement;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async approveSettlement(groupId, settlementId, userId, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const settlement = await settlementsRepository.findById(settlementId);
    if (!settlement || settlement.group_id !== groupId) throw notFound('Settlement');
    if (settlement.status !== 'requested') throw badRequest('Settlement is not in requested status');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const approved = await settlementsRepository.approve(settlementId, userId, client);

      const ledgerEntries = buildSettlementLedgerEntries({
        groupId,
        settlementId,
        currency: group.currency,
        fromMemberId: settlement.from_member_id,
        toMemberId: settlement.to_member_id,
        amount: settlement.amount,
        occurredAt: new Date(),
      });
      await ledgerRepository.createEntries(ledgerEntries, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'settlement',
        entityId: settlementId,
        action: 'approve',
        summary: `Approved settlement of ${group.currency} ${settlement.amount}`,
        ...getRequestMeta(req),
      }, client);

      if (settlement.requested_by && settlement.requested_by !== userId) {
        await notificationsRepository.create({
          userId: settlement.requested_by,
          groupId,
          type: 'settlement_completed',
          title: 'Settlement Approved',
          body: `Your settlement request of ${group.currency} ${settlement.amount} was approved in "${group.name}"`,
          entityType: 'settlement',
          entityId: settlementId,
        }, client);
      }

      await client.query('COMMIT');
      return approved;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async rejectSettlement(groupId, settlementId, userId, req) {
    const settlement = await settlementsRepository.findById(settlementId);
    if (!settlement || settlement.group_id !== groupId) throw notFound('Settlement');
    if (settlement.status !== 'requested') throw badRequest('Settlement is not in requested status');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const rejected = await settlementsRepository.reject(settlementId, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'settlement',
        entityId: settlementId,
        action: 'reject',
        summary: `Rejected settlement request of ${settlement.currency} ${settlement.amount}`,
        ...getRequestMeta(req),
      }, client);

      if (settlement.requested_by && settlement.requested_by !== userId) {
        await notificationsRepository.create({
          userId: settlement.requested_by,
          groupId,
          type: 'settlement_reversal',
          title: 'Settlement Request Rejected',
          body: `Your settlement request of ${settlement.currency} ${settlement.amount} was rejected`,
          entityType: 'settlement',
          entityId: settlementId,
        }, client);
      }

      await client.query('COMMIT');
      return rejected;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async reverseSettlement(groupId, settlementId, userId, reason, req) {
    const settlement = await settlementsRepository.findById(settlementId);
    if (!settlement || settlement.group_id !== groupId) throw notFound('Settlement');
    if (settlement.status !== 'completed') throw badRequest('Only completed settlements can be reversed');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await ledgerRepository.voidByReference('settlement', settlementId, client);

      const reversed = await settlementsRepository.reverse(settlementId, { reversedBy: userId, reversalReason: reason }, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'settlement',
        entityId: settlementId,
        action: 'reverse',
        summary: `Reversed settlement of ${settlement.currency} ${settlement.amount}. Reason: ${reason}`,
        ...getRequestMeta(req),
      }, client);

      const fromMember = await groupMembersRepository.findById(settlement.from_member_id);
      const toMember = await groupMembersRepository.findById(settlement.to_member_id);
      const otherUserId = fromMember.user_id === userId ? toMember.user_id : fromMember.user_id;
      if (otherUserId) {
        await notificationsRepository.create({
          userId: otherUserId,
          groupId,
          type: 'settlement_reversal',
          title: 'Settlement Reversed',
          body: `A settlement of ${settlement.currency} ${settlement.amount} was reversed by the other party`,
          entityType: 'settlement',
          entityId: settlementId,
        }, client);
      }

      await client.query('COMMIT');
      return reversed;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async sendReminder(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const fromMember = await groupMembersRepository.findActiveMembership(groupId, userId);
    if (!fromMember) throw forbidden('Not a member of this group');

    const toMember = await groupMembersRepository.findById(data.toMemberId);
    if (!toMember || toMember.group_id !== groupId) throw badRequest('Invalid target member');

    const reminder = await settlementRemindersRepository.create({
      groupId,
      fromMemberId: fromMember.id,
      toMemberId: data.toMemberId,
      amount: data.amount,
      message: data.message,
      sentBy: userId,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'settlement',
      entityId: reminder.id,
      action: 'remind',
      summary: `Sent settlement reminder to ${toMember.full_name || 'member'} for ${group.currency} ${data.amount}`,
      ...getRequestMeta(req),
    });

    if (toMember.user_id) {
      await notificationsRepository.create({
        userId: toMember.user_id,
        groupId,
        type: 'settlement_reminder',
        title: 'Settlement Reminder',
        body: `${fromMember.full_name || 'A group member'} reminded you to settle: ${data.message || `Outstanding balance of ${group.currency} ${data.amount}`}`,
        entityType: 'settlement_reminder',
        entityId: reminder.id,
      });
    }

    return reminder;
  },

  async getSettlements(groupId, query) {
    const { page, limit, offset } = getPagination(query);
    return settlementsRepository.findByGroupId(groupId, { limit, offset, status: query.status });
  },

  async getSettlement(groupId, settlementId) {
    const settlement = await settlementsRepository.findById(settlementId);
    if (!settlement || settlement.group_id !== groupId) throw notFound('Settlement');
    return settlement;
  },

  async cancelSettlement(groupId, settlementId, userId, req) {
    const settlement = await settlementsRepository.findById(settlementId);
    if (!settlement || settlement.group_id !== groupId) throw notFound('Settlement');
    if (settlement.status === 'cancelled') throw badRequest('Settlement already cancelled');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await ledgerRepository.voidByReference('settlement', settlementId, client);

      await settlementsRepository.updateStatus(settlementId, 'cancelled', client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'settlement',
        entityId: settlementId,
        action: 'void',
        summary: `Cancelled settlement of ${settlement.currency} ${settlement.amount}`,
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'settlement.cancel',
        entityType: 'settlement',
        entityId: settlementId,
        beforeState: { status: settlement.status },
        afterState: { status: 'cancelled' },
      }, client);

      await client.query('COMMIT');
      return { id: settlementId, status: 'cancelled' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async restoreSettlement(groupId, settlementId, userId, req) {
    const settlement = await settlementsRepository.findDeletedById(settlementId);
    if (!settlement || settlement.group_id !== groupId) throw notFound('Settlement');

    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const restored = await settlementsRepository.restore(settlementId, client);

      const ledgerEntries = buildSettlementLedgerEntries({
        groupId,
        settlementId,
        currency: group.currency,
        fromMemberId: settlement.from_member_id,
        toMemberId: settlement.to_member_id,
        amount: settlement.amount,
        occurredAt: new Date(),
      });
      await ledgerRepository.createEntries(ledgerEntries, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'settlement',
        entityId: settlementId,
        action: 'restore',
        summary: `Restored settlement of ${settlement.currency} ${settlement.amount}`,
        ...getRequestMeta(req),
      }, client);

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'settlement.restore',
        entityType: 'settlement',
        entityId: settlementId,
        beforeState: { status: settlement.status },
        afterState: { status: 'completed' },
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
};

export default settlementsService;
