import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import {
  getDashboardStats,
  recalculateScores,
  getFlaggedStudents,
  getStudentRiskDetail,
  markAccountReviewed,
  getDefaultThresholds,
} from '../controllers/admin.controller.js';
import { createCourse } from '../controllers/course.controller.js';
import { createClub } from '../controllers/club.controller.js';

const router = Router();

// All admin routes require authentication.
// In production, an `requireAdmin` middleware would additionally check
// req.user.role === 'admin'. For this academic project all logged-in users
// can access the admin dashboard for demonstration purposes.
router.use(authenticateJWT);

// Shared course/club record creation is restricted to administrators (Phase 3C)
router.post('/courses', requireAdmin, createCourse);
router.post('/clubs', requireAdmin, createClub);

router.get('/dashboard',                       getDashboardStats);
router.get('/thresholds',                      getDefaultThresholds);
router.post('/recalculate',                    recalculateScores);
router.get('/flagged',                         getFlaggedStudents);
router.get('/student/:studentId/risk',         getStudentRiskDetail);
router.post('/student/:studentId/review',      markAccountReviewed);

export default router;
