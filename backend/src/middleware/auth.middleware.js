import jwt from 'jsonwebtoken';

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
 * Used to guard creation/management of shared course and club records.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Administrator privileges are required to create or manage shared course and club records.'
    });
  }
  next();
};

