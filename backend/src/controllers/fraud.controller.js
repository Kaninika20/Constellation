import * as fraudService from '../services/fraud.service.js';

export const recalculateFraudScores = async (req, res, next) => {
  try {
    const result = await fraudService.updateFraudRiskScores();
    res.json({ success: true, data: result, message: `Updated fraud risk scores for ${result.updated} students` });
  } catch (err) { next(err); }
};

export const analyzeSuspiciousActivity = async (req, res, next) => {
  try {
    const result = await fraudService.analyzeSuspiciousActivity(req.body?.config);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getSuspiciousActivityAnalysis = async (req, res, next) => {
  try {
    const result = await fraudService.getSuspiciousActivityAnalysis();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getHighRiskStudents = async (req, res, next) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 0.4;
    const students = await fraudService.getHighRiskStudents(threshold);
    res.json({ success: true, data: students, count: students.length });
  } catch (err) { next(err); }
};

export const getSybilCandidates = async (req, res, next) => {
  try {
    const candidates = await fraudService.getSybilCandidates();
    res.json({ success: true, data: candidates, count: candidates.length });
  } catch (err) { next(err); }
};

export const getSuspiciousCliques = async (req, res, next) => {
  try {
    const cliques = await fraudService.getSuspiciousCliques();
    res.json({ success: true, data: cliques, count: cliques.length });
  } catch (err) { next(err); }
};

export const getStudentFraudScore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const metrics = await fraudService.getStudentFraudMetrics(id);
    if (!metrics) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: metrics });
  } catch (err) { next(err); }
};

export const getPathBetween = async (req, res, next) => {
  try {
    const { idA, idB } = req.params;
    const result = await fraudService.getPathBetween(idA, idB);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
