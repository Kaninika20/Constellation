import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import {
  recalculateFraudScores,
  analyzeSuspiciousActivity,
  getSuspiciousActivityAnalysis,
  getHighRiskStudents,
  getSybilCandidates,
  getSuspiciousCliques,
  getStudentFraudScore,
  getPathBetween
} from '../controllers/fraud.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/analysis',            getSuspiciousActivityAnalysis);
router.post('/analyze',            analyzeSuspiciousActivity);
router.get('/risk-scores',          getHighRiskStudents);
router.get('/sybil-candidates',     getSybilCandidates);
router.get('/suspicious-cliques',   getSuspiciousCliques);
router.get('/student/:id/score',    getStudentFraudScore);
router.get('/path/:idA/:idB',       getPathBetween);
router.post('/recalculate',         recalculateFraudScores);

export default router;
