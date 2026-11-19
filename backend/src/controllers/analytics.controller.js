import * as analyticsService from '../services/analytics.service.js';

export const getGraphStats = async (req, res, next) => {
  try {
    const stats = await analyticsService.getGraphStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
};

export const getMostConnectedStudents = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const students = await analyticsService.getMostConnectedStudents(limit);
    res.json({ success: true, data: students });
  } catch (err) { next(err); }
};

export const getDepartmentDensity = async (req, res, next) => {
  try {
    const data = await analyticsService.getDepartmentDensity();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getPopularClubs = async (req, res, next) => {
  try {
    const clubs = await analyticsService.getPopularClubs();
    res.json({ success: true, data: clubs });
  } catch (err) { next(err); }
};

export const getTrendingEvents = async (req, res, next) => {
  try {
    const events = await analyticsService.getTrendingEvents();
    res.json({ success: true, data: events });
  } catch (err) { next(err); }
};
