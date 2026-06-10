import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeGroup } from '../../middleware/authorize-group.js';
import * as eventsController from '../../controllers/events.controller.js';

const router = Router({ mergeParams: true });

router.post('/', authenticate, authorizeGroup('admin'), eventsController.createEvent);
router.get('/', authenticate, authorizeGroup(), eventsController.getEvents);
router.get('/:eventId', authenticate, authorizeGroup(), eventsController.getEvent);
router.patch('/:eventId', authenticate, authorizeGroup('admin'), eventsController.updateEvent);
router.delete('/:eventId', authenticate, authorizeGroup('admin'), eventsController.deleteEvent);

router.post('/:eventId/attendance', authenticate, authorizeGroup(), eventsController.saveAttendance);
router.get('/:eventId/attendance', authenticate, authorizeGroup(), eventsController.getAttendance);
router.get('/:eventId/ledger', authenticate, authorizeGroup(), eventsController.getEventLedger);

export default router;
