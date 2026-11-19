import * as adminService from '../services/admin.service.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await adminService.getAdminDashboardStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (err) { next(err); }
};

export const recalculateScores = async (req, res, next) => {
  try {
    const thresholds = {};
    if (req.body?.lowRisk   !== undefined) thresholds.lowRisk   = parseFloat(req.body.lowRisk);
    if (req.body?.highRisk  !== undefined) thresholds.highRisk  = parseFloat(req.body.highRisk);
    if (req.body?.highFollowing !== undefined) thresholds.highFollowing = parseInt(req.body.highFollowing, 10);
    if (req.body?.pendingReqFlood !== undefined) thresholds.pendingReqFlood = parseInt(req.body.pendingReqFlood, 10);
    if (req.body?.denseNoAcadFriends !== undefined) thresholds.denseNoAcadFriends = parseInt(req.body.denseNoAcadFriends, 10);

    const result = await adminService.recalculateEnhancedScores(thresholds);
    return res.status(200).json({
      success: true,
      message: `Enhanced risk scores updated for ${result.updated} students.`,
      data: result,
    });
  } catch (err) { next(err); }
};

export const getFlaggedStudents = async (req, res, next) => {
  try {
    const thresholds = {};
    if (req.query.lowRisk  !== undefined) thresholds.lowRisk  = parseFloat(req.query.lowRisk);
    if (req.query.highRisk !== undefined) thresholds.highRisk = parseFloat(req.query.highRisk);

    const students = await adminService.getFlaggedStudents(thresholds);
    return res.status(200).json({ success: true, data: students, count: students.length });
  } catch (err) { next(err); }
};

export const getStudentRiskDetail = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const detail = await adminService.getStudentRiskDetail(studentId);
    if (!detail) {
      return res.status(404).json({ error: 'Not Found', message: 'Student not found.' });
    }
    return res.status(200).json({ success: true, data: detail });
  } catch (err) { next(err); }
};

export const markAccountReviewed = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const reviewerStudentId = req.user.studentId;
    const notes = req.body?.notes || '';

    const result = await adminService.markAccountReviewed(studentId, reviewerStudentId, notes);
    return res.status(200).json({
      success: true,
      message: 'Account marked as reviewed.',
      data: result,
    });
  } catch (err) { next(err); }
};

export const getDefaultThresholds = async (req, res, next) => {
  try {
    const { DEFAULT_THRESHOLDS } = await import('../services/admin.service.js');
    return res.status(200).json({ success: true, data: DEFAULT_THRESHOLDS });
  } catch (err) { next(err); }
};
