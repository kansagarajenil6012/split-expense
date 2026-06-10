import { getClient } from '../config/database.js';
import settlementsRepository from '../repositories/settlements.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import ledgerRepository from '../repositories/ledger.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import { buildSettlementLedgerEntries, getGroupBalances } from '../engines/ledger.engine.js';
import { notFound, badRequest } from '../utils/app-error.js';
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

      // Void the ledger entries created by this settlement
      await ledgerRepository.voidByReference('settlement', settlementId, client);

      // Update settlement status
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

      // Recreate ledger entries
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
