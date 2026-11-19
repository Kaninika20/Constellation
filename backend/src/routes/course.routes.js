import { Router } from 'express';
import { getCourses, enrollCourse, dropCourse, getCourseStudents, getCourseDetail, getMyCourses } from '../controllers/course.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Optional JWT check for GET /api/courses so logged in user can see their enrollment state
router.get('/', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }
  next();
}, getCourses);

// "My Courses" — courses the authenticated student is enrolled in (before /:courseCode)
router.get('/enrolled', authenticateJWT, getMyCourses);

// Course details (course node + enrolled students)
router.get('/:courseCode', getCourseDetail);

router.get('/:courseCode/students', getCourseStudents);

// Protected actions: enroll and drop (students manage their own enrollments)
router.post('/:courseCode/enroll', authenticateJWT, enrollCourse);
router.post('/:courseCode/drop', authenticateJWT, dropCourse);

export default router;

