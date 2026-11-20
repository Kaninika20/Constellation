import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import {
  getDashboardStats,
  getAdminNetworkOverview,
  recalculateScores,
  runRiskAnalysis,
  getFlaggedStudents,
  getStudentRiskDetail,
  markAccountReviewed,
  getDefaultThresholds,
  setStudentRole,
} from '../controllers/admin.controller.js';
import { createCourse } from '../controllers/course.controller.js';
import { createClub } from '../controllers/club.controller.js';
import { createEvent as createAdminEvent } from '../controllers/event.controller.js';

const router = Router();

router.use(authenticateJWT);
router.use(requireAdmin);

router.post('/courses', createCourse);
router.post('/clubs', createClub);
router.post('/events', createAdminEvent);
router.patch('/students/:studentId/role', setStudentRole);

router.get('/dashboard',                       getDashboardStats);
router.get('/graph',                           getAdminNetworkOverview);
router.get('/thresholds',                      getDefaultThresholds);
router.post('/recalculate',                    recalculateScores);
router.post('/analyze',                         runRiskAnalysis);
router.get('/flagged',                         getFlaggedStudents);
router.get('/student/:studentId/risk',         getStudentRiskDetail);
router.post('/student/:studentId/review',      markAccountReviewed);

export default router;
