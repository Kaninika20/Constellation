import { Router } from 'express';
import {
  getStudents,
  getMyProfile,
  getStudentById,
  updateStudentProfile,
  createStudent,
  getNetworkOverview
} from '../controllers/student.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validateProfileUpdate, validateRegister } from '../middleware/validation.middleware.js';

const router = Router();

// Student Directory & Search (with filters: ?search=...&department=...&yearOfStudy=...)
router.get('/', getStudents);

// Network graph overview for Cytoscape.js
router.get('/network/overview', getNetworkOverview);

// View authenticated student's own profile (Must be defined before /:id)
router.get('/me', authenticateJWT, getMyProfile);

// View another student's profile by ID
router.get('/:id', getStudentById);

// Update own student profile (Protected by JWT and input validation)
router.put('/:id', authenticateJWT, validateProfileUpdate, updateStudentProfile);

// Create student profile
router.post('/', validateRegister, createStudent);

export default router;
