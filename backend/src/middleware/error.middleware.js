/**
 * Centralized Express Error Handling Middleware.
 * Distinguishes Neo4j constraint violations from general server errors.
 */
export const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]', err);

  // Neo4j Constraint Violation Check
  if (err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
    return res.status(409).json({
      error: 'Conflict / Constraint Violation',
      message: 'A node with this unique identifier already exists in the graph database.',
      details: err.message
    });
  }

  // Neo4j Connection or Driver Errors
  if (err.code && (err.code.startsWith('ServiceUnavailable') || err.code.startsWith('SessionExpired'))) {
    return res.status(503).json({
      error: 'Database Service Unavailable',
      message: 'Could not connect to Neo4j. Check database status and connection credentials.',
      code: err.code
    });
  }

  // Custom status code if provided
  const status = err.statusCode || 500;
  return res.status(status).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected server error occurred.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
};

/**
 * 404 Not Found Middleware for unhandled routes
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Resource not found at [${req.method}] ${req.originalUrl}`
  });
};

