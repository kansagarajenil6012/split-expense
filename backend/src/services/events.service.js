import eventsRepository from '../repositories/events.repository.js';
import groupsRepository from '../repositories/groups.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import { query } from '../config/database.js';
import { notFound, forbidden } from '../utils/app-error.js';
import { logActivity, getRequestMeta } from './audit.service.js';
import { optimizeSettlements } from '../engines/ledger.engine.js';

const eventsService = {
  async createEvent(groupId, userId, data, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const event = await eventsRepository.create({
      groupId,
      name: data.name,
      description: data.description,
      eventType: data.eventType || 'trip',
      location: data.location,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status: data.status || 'planned',
      createdBy: userId,
      settings: data.settings || {}
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'event',
      entityId: event.id,
      action: 'create',
      summary: `Created event "${event.name}" (${event.event_type})`,
      ...getRequestMeta(req),
    });

    return event;
  },

  async getEvents(groupId) {
    return eventsRepository.findByGroupId(groupId);
  },

  async getEvent(groupId, eventId) {
    const event = await eventsRepository.findById(eventId);
    if (!event || event.group_id !== groupId) throw notFound('Event');
    return event;
  },

  async updateEvent(groupId, eventId, userId, data, req) {
    const event = await eventsRepository.findById(eventId);
    if (!event || event.group_id !== groupId) throw notFound('Event');

    const updated = await eventsRepository.update(eventId, {
      name: data.name ?? event.name,
      description: data.description ?? event.description,
      eventType: data.eventType ?? event.event_type,
      location: data.location ?? event.location,
      startsAt: data.startsAt ?? event.starts_at,
      endsAt: data.endsAt ?? event.ends_at,
      status: data.status ?? event.status,
      settings: data.settings ?? event.settings,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'event',
      entityId: eventId,
      action: 'update',
      summary: `Updated event "${updated.name}"`,
      ...getRequestMeta(req),
    });

    return updated;
  },

  async deleteEvent(groupId, eventId, userId, req) {
    const event = await eventsRepository.findById(eventId);
    if (!event || event.group_id !== groupId) throw notFound('Event');

    await eventsRepository.softDelete(eventId);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'event',
      entityId: eventId,
      action: 'delete',
      summary: `Deleted event "${event.name}"`,
      ...getRequestMeta(req),
    });

    return { id: eventId };
  },

  async saveAttendance(groupId, eventId, attendanceList, userId) {
    const event = await eventsRepository.findById(eventId);
    if (!event || event.group_id !== groupId) throw notFound('Event');

    return eventsRepository.saveAttendance(eventId, attendanceList);
  },

  async getAttendance(groupId, eventId) {
    const event = await eventsRepository.findById(eventId);
    if (!event || event.group_id !== groupId) throw notFound('Event');

    return eventsRepository.getAttendance(eventId);
  },

  async getEventLedger(groupId, eventId) {
    const event = await eventsRepository.findById(eventId);
    if (!event || event.group_id !== groupId) throw notFound('Event');

    // Query live balances specifically derived from the event's expenses
    const { rows: balances } = await query(
      `SELECT gm.id as member_id, gm.user_id, u.full_name, u.avatar_url,
              COALESCE(SUM(le.amount), 0) as balance
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN ledger_entries le ON le.member_id = gm.id 
         AND le.deleted_at IS NULL
         AND le.reference_type = 'expense'
         AND le.reference_id IN (
           SELECT id FROM expenses WHERE event_id = $1 AND deleted_at IS NULL AND status = 'active'
         )
       WHERE gm.group_id = $2 AND gm.status = 'active' AND gm.deleted_at IS NULL
       GROUP BY gm.id, gm.user_id, u.full_name, u.avatar_url
       ORDER BY balance DESC`,
      [eventId, groupId]
    );

    const formattedBalances = balances.map((r) => ({ ...r, balance: parseFloat(r.balance) }));
    const optimized = optimizeSettlements(formattedBalances);

    return {
      balances: formattedBalances,
      suggestedSettlements: optimized,
    };
  }
};

export default eventsService;
