import jwt from 'jsonwebtoken';
import { getSession } from '../config/neo4j.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

/**
 * Middleware to protect routes and verify JWT token in Authorization header.
 */
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is missing or malformed. Header format: Bearer <token>'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { studentId, email, role }
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token has expired or is invalid.',
      details: error.message
    });
  }
};

/**
 * Middleware restricting a route to administrators.
 * Must run after authenticateJWT (which populates req.user).
 * Used for all administrator-only investigation and management APIs.
 */
export const requireAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Administrator privileges are required to access this resource.'
    });
  }

  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (s:Student {studentId: $studentId})
      RETURN s.role AS role
    `, { studentId: req.user.studentId });
    if (result.records[0]?.get('role') !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Administrator privileges are required to access this resource.'
      });
    }
    return next();
  } catch (error) {
    return next(error);
  } finally {
    await session.close();
  }
};

