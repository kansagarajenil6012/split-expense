import eventsService from '../services/events.service.js';
import { success, created, noContent } from '../utils/api-response.js';

export const createEvent = async (req, res, next) => {
  try {
    const event = await eventsService.createEvent(req.groupId, req.user.id, req.body, req);
    created(res, event);
  } catch (err) { next(err); }
};

export const getEvents = async (req, res, next) => {
  try {
    const events = await eventsService.getEvents(req.groupId);
    success(res, events);
  } catch (err) { next(err); }
};

export const getEvent = async (req, res, next) => {
  try {
    const event = await eventsService.getEvent(req.groupId, req.params.eventId);
    success(res, event);
  } catch (err) { next(err); }
};

export const updateEvent = async (req, res, next) => {
  try {
    const event = await eventsService.updateEvent(req.groupId, req.params.eventId, req.user.id, req.body, req);
    success(res, event);
  } catch (err) { next(err); }
};

export const deleteEvent = async (req, res, next) => {
  try {
    await eventsService.deleteEvent(req.groupId, req.params.eventId, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const saveAttendance = async (req, res, next) => {
  try {
    const attendance = await eventsService.saveAttendance(req.groupId, req.params.eventId, req.body.attendance, req.user.id);
    success(res, attendance);
  } catch (err) { next(err); }
};

export const getAttendance = async (req, res, next) => {
  try {
    const attendance = await eventsService.getAttendance(req.groupId, req.params.eventId);
    success(res, attendance);
  } catch (err) { next(err); }
};

export const getEventLedger = async (req, res, next) => {
  try {
    const ledger = await eventsService.getEventLedger(req.groupId, req.params.eventId);
    success(res, ledger);
  } catch (err) { next(err); }
};
