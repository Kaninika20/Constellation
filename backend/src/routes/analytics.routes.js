import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import {
  getGraphStats,
  getMostConnectedStudents,
  getDepartmentDensity,
  getPopularClubs,
  getTrendingEvents
} from '../controllers/analytics.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/stats',               getGraphStats);
router.get('/top-students',        getMostConnectedStudents);
router.get('/department-density',  getDepartmentDensity);
router.get('/popular-clubs',       getPopularClubs);
router.get('/trending-events',     getTrendingEvents);

export default router;
