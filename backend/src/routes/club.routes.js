import { Router } from 'express';
import { getClubs, joinClub, leaveClub, getClubMembers, getClubDetail, getMyClubs } from '../controllers/club.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Optional JWT check for GET /api/clubs so logged in user can see their membership state
router.get('/', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }
  next();
}, getClubs);

// "My Clubs" — clubs the authenticated student has joined (before /:clubId)
router.get('/joined', authenticateJWT, getMyClubs);

// Club details (club node + members)
router.get('/:clubId', getClubDetail);

router.get('/:clubId/members', getClubMembers);

// Protected actions: join and leave (students manage their own memberships)
router.post('/:clubId/join', authenticateJWT, joinClub);
router.post('/:clubId/leave', authenticateJWT, leaveClub);

export default router;

