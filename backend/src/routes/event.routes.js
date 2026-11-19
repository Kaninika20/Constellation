import { Router } from 'express';
import {
  getEvents,
  createEvent,
  registerForEvent,
  cancelEventRegistration,
  getEventParticipants
} from '../controllers/event.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Optional JWT check for GET /api/events so logged in user can see their registration state
router.get('/', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }
  next();
}, getEvents);

router.get('/:eventId/participants', getEventParticipants);

// Protected actions: create, register, cancel
router.post('/', authenticateJWT, createEvent);
router.post('/:eventId/register', authenticateJWT, registerForEvent);
router.post('/:eventId/cancel', authenticateJWT, cancelEventRegistration);

export default router;

