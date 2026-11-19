import { Router } from 'express';
import {
  getRecommendations,
  getMutualFriends,
  getConnectionPath,
  getWeights,
  getSharedConnections,
} from '../controllers/recommendation.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

// All recommendation endpoints require a logged-in user
router.use(authenticateJWT);

// GET /api/recommendations         – personalised student recommendations
router.get('/', getRecommendations);

// GET /api/recommendations/weights – return default scoring weights
router.get('/weights', getWeights);

// GET /api/recommendations/mutual/:targetStudentId – mutual friends
router.get('/mutual/:targetStudentId', getMutualFriends);

// GET /api/recommendations/shared/:targetStudentId – all shared connections (friends + courses + clubs + interests + events)
router.get('/shared/:targetStudentId', getSharedConnections);

// GET /api/recommendations/path/:targetStudentId   – connection path finder
router.get('/path/:targetStudentId', getConnectionPath);

export default router;
