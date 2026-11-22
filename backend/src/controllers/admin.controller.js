import * as adminService from '../services/admin.service.js';
import { getNetworkGraph } from '../services/student.service.js';
import { analyzeSuspiciousActivity } from '../services/fraud.service.js';

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

export const runRiskAnalysis = async (req, res, next) => {
  try {
    const result = await analyzeSuspiciousActivity(req.body?.config);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getAdminNetworkOverview = async (req, res, next) => {
  try {
    const network = await getNetworkGraph({
      limit: req.query.limit ?? 100,
      includeRiskDetails: true
    });
    return res.status(200).json({ success: true, data: network });
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

export const getStudentSuspiciousNetwork = async (req, res, next) => {
  try {
    const network = await adminService.getStudentSuspiciousNetwork(req.params.studentId);
    if (!network) {
      return res.status(404).json({ error: 'Not Found', message: 'Student not found.' });
    }
    return res.status(200).json({ success: true, data: network });
  } catch (err) { next(err); }
};

export const markAccountReviewed = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const reviewerStudentId = req.user.studentId;
    const notes = req.body?.notes ?? '';
    if (typeof notes !== 'string' || notes.length > 2000) {
      return res.status(400).json({ success: false, message: 'Review notes must be text no longer than 2000 characters.' });
    }

    const result = await adminService.markAccountReviewed(studentId, reviewerStudentId, notes);
    return res.status(200).json({
      success: true,
      message: 'Account marked as reviewed.',
      data: result,
    });
  } catch (err) { next(err); }
};

export const getMessageReports = async (req, res, next) => {
  try {
    const status = req.query.status === undefined ? 'pending' : req.query.status;
    if (!['pending', 'reviewed', 'dismissed', 'all'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Report status must be pending, reviewed, dismissed, or all.'
      });
    }
    const reports = await adminService.getMessageReports(status === 'all' ? null : status);
    return res.status(200).json({ success: true, data: reports, count: reports.length });
  } catch (err) { next(err); }
};

export const reviewMessageReport = async (req, res, next) => {
  try {
    const { status, notes = '' } = req.body || {};
    if (!['reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Report status must be reviewed or dismissed.'
      });
    }
    if (typeof notes !== 'string' || notes.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Review notes must be text no longer than 2000 characters.'
      });
    }
    const report = await adminService.reviewMessageReport(
      req.params.reportId,
      req.user.studentId,
      status,
      notes
    );
    return res.status(200).json({ success: true, data: report });
  } catch (err) { next(err); }
};

export const getDefaultThresholds = async (req, res, next) => {
  try {
    const { DEFAULT_THRESHOLDS } = await import('../services/admin.service.js');
    return res.status(200).json({ success: true, data: DEFAULT_THRESHOLDS });
  } catch (err) { next(err); }
};

export const setStudentRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!['student', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either student or admin.'
      });
    }

    const student = await adminService.setStudentRole(req.params.studentId, role);
    return res.status(200).json({
      success: true,
      message: role === 'admin' ? 'Administrator access granted.' : 'Administrator access removed.',
      data: student
    });
  } catch (err) { next(err); }
};
