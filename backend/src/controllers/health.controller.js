import { verifyConnection } from '../config/neo4j.config.js';

export const getHealth = async (req, res, next) => {
  try {
    const dbStatus = await verifyConnection();

    const isHealthy = dbStatus.connected;
    const statusCode = isHealthy ? 200 : 503;

    return res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'Constellation Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        type: 'Neo4j Graph Database',
        ...dbStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

