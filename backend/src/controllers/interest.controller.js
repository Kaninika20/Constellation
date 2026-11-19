import * as interestService from '../services/interest.service.js';

/**
 * GET /api/interests           — browse/search available interests (?search=&limit=)
 * GET /api/interests/popular   — most popular interests by student count
 * GET /api/interests/:name/students — students sharing a given interest
 */
export const searchInterests = async (req, res, next) => {
  try {
    const { search, limit } = req.query;
    const interests = await interestService.searchInterests(search, limit);
    return res.status(200).json({ data: interests });
  } catch (error) {
    next(error);
  }
};

export const getPopularInterests = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const interests = await interestService.getPopularInterests(limit);
    return res.status(200).json({ data: interests });
  } catch (error) {
    next(error);
  }
};

export const getStudentsByInterest = async (req, res, next) => {
  try {
    const { name } = req.params;
    const students = await interestService.getStudentsByInterest(name);
    return res.status(200).json({ data: students });
  } catch (error) {
    next(error);
  }
};
