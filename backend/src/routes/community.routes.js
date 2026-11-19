import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import {
  detectCommunities,
  getCommunityMembers,
  getCommunityStats,
} from '../controllers/community.controller.js';

const router = Router();
router.use(authenticateJWT);

router.post('/detect',              detectCommunities);    // run detection
router.get('/stats',                getCommunityStats);    // summary stats
router.get('/members/:communityId', getCommunityMembers);  // members of one community

export default router;
