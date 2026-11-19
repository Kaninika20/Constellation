import * as recService from '../services/recommendation.service.js';

/**
 * GET /api/recommendations
 * Returns personalized student recommendations for the logged-in user.
 *
 * Query params:
 *   limit         (number, default 20)
 *   wFriends      (number, override commonFriends weight)
 *   wCourses      (number, override sharedCourses weight)
 *   wInterests    (number, override sharedInterests weight)
 *   wClubs        (number, override sharedClubs weight)
 *   wEvents       (number, override commonEvents weight)
 */
export const getRecommendations = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    // Allow weight overrides from query string (for demonstration)
    const weights = {};
    if (req.query.wFriends)   weights.commonFriends   = parseFloat(req.query.wFriends);
    if (req.query.wCourses)   weights.sharedCourses   = parseFloat(req.query.wCourses);
    if (req.query.wInterests) weights.sharedInterests = parseFloat(req.query.wInterests);
    if (req.query.wClubs)     weights.sharedClubs     = parseFloat(req.query.wClubs);
    if (req.query.wEvents)    weights.commonEvents    = parseFloat(req.query.wEvents);

    const recommendations = await recService.getRecommendations(studentId, weights, limit);
    const defaultWeights  = recService.getScoringWeights();

    return res.status(200).json({
      data: {
        recommendations,
        appliedWeights: { ...defaultWeights, ...weights },
        total: recommendations.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recommendations/mutual/:targetStudentId
 * Returns mutual friends between the logged-in student and a target student.
 */
export const getMutualFriends = async (req, res, next) => {
  try {
    const studentIdA = req.user.studentId;
    const { targetStudentId } = req.params;

    if (!targetStudentId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'targetStudentId is required.',
      });
    }

    const result = await recService.getMutualFriends(studentIdA, targetStudentId);

    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recommendations/path/:targetStudentId
 * Returns the shortest connection path between the logged-in student and a target.
 *
 * Query params:
 *   maxHops  (number, default 6, max 10)
 */
export const getConnectionPath = async (req, res, next) => {
  try {
    const studentIdA = req.user.studentId;
    const { targetStudentId } = req.params;
    const maxHops = Math.min(parseInt(req.query.maxHops, 10) || 6, 10);

    if (!targetStudentId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'targetStudentId is required.',
      });
    }

    const result = await recService.getConnectionPath(studentIdA, targetStudentId, maxHops);

    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recommendations/weights
 * Returns the default scoring weights.
 */
export const getWeights = async (req, res, next) => {
  try {
    return res.status(200).json({ data: recService.getScoringWeights() });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recommendations/shared/:targetStudentId
 * Returns all shared connections between the logged-in student and a target:
 * mutual friends, shared courses, shared clubs, shared interests, common events.
 */
export const getSharedConnections = async (req, res, next) => {
  try {
    const studentIdA = req.user.studentId;
    const { targetStudentId } = req.params;

    if (!targetStudentId) {
      return res.status(400).json({ error: 'Validation Error', message: 'targetStudentId is required.' });
    }

    const result = await recService.getMutualConnections(studentIdA, targetStudentId);
    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
